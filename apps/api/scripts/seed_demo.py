"""Fill a LeadForge database with a realistic, clearly synthetic demo pipeline.

Usage (from the repo root, DATABASE_URL pointing at the target database):
    python -m apps.api.scripts.seed_demo            # adds the demo data once
    python -m apps.api.scripts.seed_demo --reset    # removes earlier demo data, then adds it again
    python -m apps.api.scripts.seed_demo --remove   # removes the demo data only

Every demo company uses a reserved `.example` domain, so no demo address can
ever receive a real email, and the data can always be found and removed.
Scores are computed with the real scoring rules (services/scoring_service.py).

What it creates: 3 campaigns and 14 leads spread over the last 25 days, at
every stage: new, researched, scored, drafted (waiting in Approvals), sent,
replied, booked and unsubscribed. Leads at "new" are left for a live demo of
"Run AI research" (needs GEMINI_API_KEY on the API).
"""

import argparse
import asyncio
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func
from sqlalchemy.future import select

from apps.api.db.session import SessionLocal, engine
from apps.api.models.orm.activity_log import ActivityLog
from apps.api.models.orm.campaign import Campaign
from apps.api.models.orm.company import Company
from apps.api.models.orm.enrichment import EnrichmentData
from apps.api.models.orm.lead import Lead
from apps.api.models.orm.lead_score import LeadScore
from apps.api.models.orm.organization import Organization
from apps.api.models.orm.outreach_message import OutreachMessage
from apps.api.models.orm.research_brief import ResearchBrief
from apps.api.models.schemas import LeadInput
from apps.api.services.scoring_service import score_lead

DEMO_SUFFIX = ".example"
CAMPAIGN_PREFIX = "Demo: "

CAMPAIGNS = {
    "saas": ("Demo: Series A–B SaaS growth leaders (US)", {"industry": "SaaS", "company_size": "50-200 employees"}, True),
    "dtc": ("Demo: DTC brands scaling paid social", {"industry": "E-commerce / DTC", "company_size": "10-50 employees"}, True),
    "fin": ("Demo: FinTech marketing heads", {"industry": "FinTech", "company_size": "200-500 employees"}, False),
}

# (stage, days_ago, campaign, company, lead, enrichment, research, draft)
LEADS = [
    dict(stage="new", days=1, campaign="saas",
         company=dict(name="Northwind Analytics", domain="northwind-analytics.example", industry="SaaS", employees=90,
                      revenue="$5M-$10M", funding="Series A", tech=["HubSpot", "Segment", "Webflow"]),
         lead=dict(name="Priya Shah", title="VP Marketing", verified=True, linkedin=True),
         hiring=["Growth Marketing Manager", "Demand Generation Lead"], news=["Raised a $14M Series A"]),
    dict(stage="new", days=2, campaign="dtc",
         company=dict(name="Bramble & Oak", domain="brambleoak.example", industry="DTC", employees=35,
                      revenue="$1M-$5M", funding="Seed", tech=["Shopify", "Klaviyo", "Meta Ads"]),
         lead=dict(name="Marcus Lindqvist", title="Head of Growth", verified=True, linkedin=True),
         hiring=["Performance Marketing Specialist"], news=["Launched a subscription box"]),
    dict(stage="new", days=3, campaign="fin",
         company=dict(name="Ledgerline", domain="ledgerline.example", industry="FinTech", employees=320,
                      revenue="$20M-$50M", funding="Series C", tech=["Salesforce", "Marketo"]),
         lead=dict(name="Hannah Okafor", title="Director of Brand", verified=False, linkedin=True),
         hiring=[], news=[]),

    dict(stage="researched", days=4, campaign="saas",
         company=dict(name="Quillstack", domain="quillstack.example", industry="Software", employees=60,
                      revenue="$1M-$5M", funding="Seed", tech=["Intercom", "Google Ads"]),
         lead=dict(name="Diego Ramírez", title="Marketing Lead", verified=True, linkedin=False),
         hiring=["Content Marketing Manager"], news=["Opened a London office"],
         research=("Quillstack is a seed-stage developer-docs tool expanding into Europe with a one-person "
                   "marketing team. Hiring a content marketer suggests they need a repeatable content engine "
                   "but have no senior owner for it yet.",
                   ["New London office: EU launch content and localized ads",
                    "Hiring a content marketer: offer a content system they can hand over",
                    "Google Ads only: room to add developer-community channels"])),
    dict(stage="researched", days=6, campaign="dtc",
         company=dict(name="Saltwater Supply Co.", domain="saltwatersupply.example", industry="E-commerce", employees=18,
                      revenue="<$1M", funding=None, tech=["Shopify"]),
         lead=dict(name="Emily Tran", title="Founder", verified=True, linkedin=True),
         hiring=[], news=[],
         research=("Saltwater Supply Co. is a small Shopify store with no visible paid acquisition or email "
                   "tooling. There is little public signal to personalize on beyond the founder-led brand.",
                   ["Founder-led brand: story-driven creative",
                    "No email platform detected: quick win with flows"])),

    dict(stage="scored", days=7, campaign="saas",
         company=dict(name="Corvid Labs", domain="corvidlabs.example", industry="SaaS", employees=140,
                      revenue="$10M-$20M", funding="Series B", tech=["HubSpot", "Gong", "LinkedIn Ads"]),
         lead=dict(name="Aisha Rahman", title="Head of Demand Gen", verified=True, linkedin=True),
         hiring=["Growth Analyst", "Paid Media Manager"], news=["Series B led by a top-tier fund"],
         research=("Corvid Labs just closed a Series B and is hiring both a growth analyst and a paid media "
                   "manager, which points to a push to scale paid acquisition with tighter measurement.",
                   ["Series B: board pressure to grow pipeline quickly",
                    "Hiring paid media + analytics: they want accountable spend",
                    "LinkedIn Ads in stack: B2B paid social is already a channel"]),
         # An AE rejected the first AI draft as too generic; the lead went back to "scored"
         rejected=("Quick question", "Hi Aisha,\n\nWe are a digital marketing agency. Can we help you grow?\n\nThanks")),
    dict(stage="scored", days=9, campaign="fin",
         company=dict(name="Paysprout", domain="paysprout.example", industry="FinTech", employees=410,
                      revenue="$50M+", funding="Series D", tech=["Salesforce"]),
         lead=dict(name="Tom Becker", title="Brand Manager", verified=False, linkedin=False),
         hiring=[], news=[],
         research=("Paysprout is a late-stage payments company outside the core ICP size band, with an "
                   "established in-house brand team and no visible growth hiring.",
                   ["Large in-house team: likely low need for an outside agency"])),

    dict(stage="outreach_drafted", days=5, campaign="saas",
         company=dict(name="Helix Forms", domain="helixforms.example", industry="SaaS", employees=75,
                      revenue="$5M-$10M", funding="Series A", tech=["HubSpot", "Webflow", "Google Ads"]),
         lead=dict(name="Jordan Ellis", title="VP Growth", verified=True, linkedin=True),
         hiring=["Growth Marketing Manager"], news=["Raised a $9M Series A"],
         research=("Helix Forms raised a Series A and is hiring its first growth marketer, so the VP Growth "
                   "is likely covering paid and lifecycle alone while building the team.",
                   ["Fresh Series A: targets for pipeline growth",
                    "First growth hire: interim help until the role is filled",
                    "Webflow + HubSpot: fast landing-page tests"]),
         draft=("Bridging the gap before your first growth hire",
                "Hi Jordan,\n\nCongrats on the Series A. I saw Helix Forms is hiring its first growth marketing "
                "manager, which usually means the VP Growth is running paid and lifecycle alone for a while.\n\n"
                "We run paid acquisition and landing-page testing for Series A SaaS teams on HubSpot and Webflow, "
                "and we hand everything over cleanly once the in-house hire starts.\n\n"
                "Would a 20-minute call next week be useful?")),
    dict(stage="outreach_drafted", days=8, campaign="dtc",
         company=dict(name="Kindred Coffee", domain="kindredcoffee.example", industry="DTC", employees=45,
                      revenue="$5M-$10M", funding="Seed", tech=["Shopify", "Klaviyo", "TikTok Ads"]),
         lead=dict(name="Sofia Marino", title="Director of Ecommerce", verified=True, linkedin=True),
         hiring=["Growth Marketing Lead"], news=["Entered 400 grocery stores"],
         research=("Kindred Coffee is moving from DTC into retail and hiring a growth lead, so online "
                   "acquisition has to keep pace while the team's attention shifts to stores.",
                   ["Retail expansion: protect DTC growth during the shift",
                    "TikTok Ads in stack: creative testing at volume",
                    "Hiring a growth lead: interim support"]),
         draft=("Keeping DTC growing while Kindred goes into stores",
                "Hi Sofia,\n\nSaw the news about Kindred landing in 400 grocery stores, great milestone. When "
                "brands make that move, online acquisition often stalls while the team focuses on retail.\n\n"
                "We run TikTok and Meta creative testing for Shopify brands at your stage, so DTC keeps growing "
                "while you build out retail.\n\nOpen to a short call to compare notes?")),
    dict(stage="outreach_drafted", days=10, campaign="saas",
         company=dict(name="Tidepool CRM", domain="tidepoolcrm.example", industry="SaaS", employees=110,
                      revenue="$10M-$20M", funding="Series B", tech=["Salesforce", "6sense", "LinkedIn Ads"]),
         lead=dict(name="Ben Adeyemi", title="Head of Marketing", verified=True, linkedin=True),
         hiring=["Demand Generation Manager", "Marketing Ops Specialist"], news=["Launched an AI assistant"],
         research=("Tidepool CRM is hiring for demand gen and marketing ops after launching an AI feature, "
                   "which suggests a launch campaign without the ops capacity to run it.",
                   ["New AI assistant: launch campaign",
                    "Hiring demand gen + ops: capacity gap right now",
                    "6sense in stack: account-based campaigns are possible"]),
         draft=("Launch support for Tidepool's AI assistant",
                "Hi Ben,\n\nThe AI assistant launch looks strong. With demand gen and marketing ops roles both "
                "open, I imagine the launch campaign is competing for very few hands.\n\n"
                "We build and run account-based launch campaigns on Salesforce and 6sense for B2B SaaS teams, "
                "and can start in about a week.\n\nWorth a quick conversation?")),

    dict(stage="outreach_sent", days=14, campaign="saas", sent_days=12,
         company=dict(name="Lumen Ledger", domain="lumenledger.example", industry="SaaS", employees=85,
                      revenue="$5M-$10M", funding="Series A", tech=["HubSpot", "Google Ads"]),
         lead=dict(name="Grace Whitfield", title="CMO", verified=True, linkedin=True),
         hiring=["Growth Marketing Manager"], news=["Raised a Series A"],
         research=("Lumen Ledger is a Series A finance SaaS hiring for growth, with Google Ads as its main "
                   "paid channel.", ["Series A growth targets", "Single paid channel: diversification"]),
         draft=("Diversifying Lumen Ledger's paid channels",
                "Hi Grace,\n\nCongrats on the Series A. Most of Lumen Ledger's paid acquisition seems to run "
                "through Google Ads; we help finance SaaS teams add LinkedIn and partner channels without "
                "raising CAC.\n\nWould a short call be useful?")),
    dict(stage="replied", days=18, campaign="dtc", sent_days=16, replied_days=15,
         company=dict(name="Peak & Pine Outfitters", domain="peakpine.example", industry="E-commerce", employees=60,
                      revenue="$5M-$10M", funding="Series A", tech=["Shopify", "Klaviyo", "Meta Ads"]),
         lead=dict(name="Lucas Moreau", title="VP Marketing", verified=True, linkedin=True),
         hiring=["Paid Social Manager"], news=["Opened a flagship store"],
         research=("Peak & Pine is hiring a paid social manager after opening a flagship store.",
                   ["Hiring paid social: interim help", "Flagship launch: local campaigns"]),
         draft=("Paid social while you hire",
                "Hi Lucas,\n\nSaw the paid social role and the new flagship. We can run Meta campaigns for "
                "Peak & Pine until your hire starts.\n\nOpen to a chat?")),
    dict(stage="booked", days=22, campaign="saas", sent_days=20, replied_days=18,
         company=dict(name="Orbitly", domain="orbitly.example", industry="SaaS", employees=120,
                      revenue="$10M-$20M", funding="Series B", tech=["HubSpot", "LinkedIn Ads", "Webflow"]),
         lead=dict(name="Nadia Petrova", title="Head of Growth", verified=True, linkedin=True),
         hiring=["Growth Marketing Manager", "Marketing Analyst"], news=["Series B announced"],
         research=("Orbitly closed a Series B and is building out a growth team with analytics support.",
                   ["Series B scale-up", "Analytics hire: measurement focus", "LinkedIn Ads already running"]),
         draft=("Scaling Orbitly's paid pipeline after the Series B",
                "Hi Nadia,\n\nCongrats on the Series B. We help growth teams at your stage scale LinkedIn and "
                "search with clear pipeline reporting.\n\nWould a call next week work?")),
    dict(stage="unsubscribed", days=20, campaign="fin", sent_days=19,
         company=dict(name="Clearvault", domain="clearvault.example", industry="FinTech", employees=230,
                      revenue="$20M-$50M", funding="Series C", tech=["Marketo"]),
         lead=dict(name="Owen Gallagher", title="Marketing Director", verified=True, linkedin=False),
         hiring=[], news=["New compliance certification"],
         research=("Clearvault recently gained a compliance certification; marketing is run in-house.",
                   ["Compliance milestone: trust-led messaging"]),
         draft=("Trust-led campaigns for Clearvault",
                "Hi Owen,\n\nCongrats on the new certification. We help FinTech teams turn compliance "
                "milestones into trust-led campaigns.\n\nInterested in a quick call?")),
]

STAGE_ORDER = ["new", "researched", "scored", "outreach_drafted", "outreach_sent", "replied", "booked", "unsubscribed"]


async def remove_demo(db) -> int:
    lead_ids = select(Lead.id).join(Company, Company.id == Lead.company_id).where(Company.domain.like(f"%{DEMO_SUFFIX}"))
    for model in (ActivityLog, OutreachMessage, LeadScore, ResearchBrief, EnrichmentData):
        await db.execute(delete(model).where(model.lead_id.in_(lead_ids)))
    removed = (await db.execute(delete(Lead).where(Lead.id.in_(lead_ids)))).rowcount or 0
    await db.execute(delete(Company).where(Company.domain.like(f"%{DEMO_SUFFIX}")))
    await db.execute(delete(Campaign).where(Campaign.name.like(f"{CAMPAIGN_PREFIX}%")))
    return removed


async def add_demo(db) -> int:
    org = (await db.execute(select(Organization).limit(1))).scalars().first()
    if org is None:
        sys.exit("No organization in this database. Run the migrations first.")
    now = datetime.now(timezone.utc)

    campaigns = {}
    for key, (name, icp, active) in CAMPAIGNS.items():
        c = Campaign(org_id=org.id, name=name, icp_filter=icp, active=active, created_at=now - timedelta(days=28))
        db.add(c)
        campaigns[key] = c
    await db.flush()

    for spec in LEADS:
        created = now - timedelta(days=spec["days"], hours=3)
        co, ld = spec["company"], spec["lead"]
        local = ld["name"].split()[0].lower()
        company = Company(org_id=org.id, domain=co["domain"], name=co["name"], industry=co["industry"],
                          employee_count=co["employees"], revenue_band=co["revenue"], funding_stage=co["funding"],
                          tech_stack=co["tech"], source="apollo", created_at=created, enriched_at=created)
        db.add(company)
        await db.flush()

        stage = spec["stage"]
        lead = Lead(org_id=org.id, company_id=company.id, campaign_id=campaigns[spec["campaign"]].id,
                    full_name=ld["name"], title=ld["title"], email=f"{local}@{co['domain']}",
                    linkedin_url=f"https://www.linkedin.com/in/{local}-demo" if ld["linkedin"] else None,
                    email_verified=ld["verified"], stage=stage, do_not_contact=stage == "unsubscribed",
                    created_at=created, updated_at=created)
        db.add(lead)
        await db.flush()

        db.add(EnrichmentData(lead_id=lead.id, hiring_signals=spec["hiring"], news_triggers=spec["news"],
                              enriched_at=created))
        log = [("system", "lead_ingested", {"email": lead.email, "company_domain": co["domain"], "demo": True}, created)]

        reached = STAGE_ORDER.index(stage)
        t = created + timedelta(hours=2)
        if reached >= STAGE_ORDER.index("researched") and "research" in spec:
            summary, angles = spec["research"]
            db.add(ResearchBrief(lead_id=lead.id, summary=summary, personalization_angles=angles,
                                 insufficient_signal=False, model_used="gemini-2.5-flash",
                                 prompt_version="research_brief_v1", created_at=t))
            log.append(("system", "lead_researched", {"prompt_version": "research_brief_v1"}, t))

        if reached >= STAGE_ORDER.index("scored"):
            s = score_lead(LeadInput(
                company_name=co["name"], domain=co["domain"], industry=co["industry"],
                employee_count=co["employees"], funding_stage=co["funding"], tech_stack=co["tech"],
                hiring_signals=spec["hiring"], news_triggers=spec["news"], full_name=ld["name"],
                title=ld["title"], email=lead.email, linkedin_url=lead.linkedin_url,
                email_verified=ld["verified"]))
            t += timedelta(minutes=5)
            db.add(LeadScore(lead_id=lead.id, fit_score=s.fit_score, intent_score=s.intent_score,
                             gap_score=s.gap_score, contactability_score=s.contactability_score,
                             engagement_score=s.engagement_score, total_score=s.total_score, tier=s.tier,
                             scoring_version="v1", created_at=t))
            log.append(("system", "lead_scored", {"total_score": s.total_score, "tier": s.tier}, t))

        if "rejected" in spec:
            subject, body = spec["rejected"]
            t += timedelta(minutes=5)
            db.add(OutreachMessage(lead_id=lead.id, sequence_step=1, subject=subject, body=body,
                                   status="rejected", bounced=False, prompt_version="outreach_draft_v1",
                                   created_at=t))
            log.append(("demo@leadforge.example", "outreach_rejected", {"reason": "too generic"}, t))

        if "draft" in spec and reached >= STAGE_ORDER.index("outreach_drafted"):
            subject, body = spec["draft"]
            t += timedelta(minutes=5)
            sent_at = now - timedelta(days=spec["sent_days"]) if "sent_days" in spec else None
            replied_at = now - timedelta(days=spec["replied_days"]) if "replied_days" in spec else None
            db.add(OutreachMessage(lead_id=lead.id, sequence_step=1, subject=subject, body=body,
                                   status="sent" if sent_at else "draft", sent_at=sent_at, replied_at=replied_at,
                                   bounced=False, prompt_version="outreach_draft_v1", created_at=t))
            log.append(("system", "outreach_drafted", {"subject": subject}, t))
            if sent_at:
                log.append(("demo@leadforge.example", "outreach_sent", {"transport": "demo"}, sent_at))
            if stage == "unsubscribed":
                log.append(("System Webhook", "opt_out", {"source": "unsubscribe_email_link"},
                            sent_at + timedelta(days=1)))

        for actor, action, detail, at in log:
            db.add(ActivityLog(lead_id=lead.id, actor=actor, action=action, detail=detail, created_at=at))

    return len(LEADS)


async def run(mode: str) -> None:
    async with SessionLocal() as db:
        existing = (await db.execute(
            select(func.count()).select_from(Company).where(Company.domain.like(f"%{DEMO_SUFFIX}"))
        )).scalar()
        if mode in ("reset", "remove"):
            removed = await remove_demo(db)
            print(f"Removed {removed} demo leads.")
        elif existing:
            print(f"Demo data is already here ({existing} demo companies). Use --reset to recreate it.")
            return
        if mode != "remove":
            added = await add_demo(db)
            print(f"Added {added} demo leads in {len(CAMPAIGNS)} campaigns.")
        await db.commit()
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Add or remove LeadForge demo data.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--reset", action="store_true", help="remove earlier demo data, then add it again")
    group.add_argument("--remove", action="store_true", help="remove the demo data only")
    args = parser.parse_args()
    asyncio.run(run("reset" if args.reset else "remove" if args.remove else "add"))


if __name__ == "__main__":
    main()
