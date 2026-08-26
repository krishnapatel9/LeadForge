from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from apps.api.clients.ai_client import call_structured
from apps.api.models.schemas import LeadInput, OutreachDraft, ResearchBrief as SchemaResearchBrief
from apps.api.models.orm.lead import Lead as ORMLead
from apps.api.models.orm.company import Company as ORMCompany
from apps.api.models.orm.research_brief import ResearchBrief as ORMResearchBrief
from apps.api.models.orm.outreach_message import OutreachMessage as ORMOutreachMessage
from apps.api.services.activity_service import log_activity

PROMPT_VERSION = "outreach_draft_v1"

# TODO: move to config/env once this needs to vary per agency/campaign.
AGENCY_CONTEXT = (
    "We are a digital marketing agency specializing in paid acquisition and "
    "content strategy for growth-stage B2B SaaS and DTC brands."
)


def draft_outreach(lead: LeadInput, research: SchemaResearchBrief) -> OutreachDraft:
    """Synchronous version compatible with Phase 1 POC logic and tests."""
    if research.insufficient_signal:
        raise ValueError(
            f"Refusing to draft outreach for {lead.email}: research brief "
            "flagged insufficient_signal — needs human review, not a generic draft."
        )

    raw = call_structured(
        PROMPT_VERSION,
        {
            "agency_context": AGENCY_CONTEXT,
            "full_name": lead.full_name,
            "title": lead.title,
            "company_name": lead.company_name,
            "research_summary": research.summary,
            "personalization_angles": "; ".join(research.personalization_angles),
        },
    )
    return OutreachDraft(**raw)


async def draft_outreach_db(
    db: AsyncSession,
    lead: ORMLead,
    company: ORMCompany,
    research: ORMResearchBrief
) -> OutreachDraft:
    """Asynchronous version that queries and writes to PostgreSQL database (Phase 2)."""
    raw = call_structured(
        PROMPT_VERSION,
        {
            "agency_context": AGENCY_CONTEXT,
            "full_name": lead.full_name,
            "title": lead.title or "unknown",
            "company_name": company.name,
            "research_summary": research.summary,
            "personalization_angles": "; ".join(research.personalization_angles) if isinstance(research.personalization_angles, list) else str(research.personalization_angles),
        },
    )
    draft = OutreachDraft(**raw)

    # Persist in DB
    db_outreach = ORMOutreachMessage(
        lead_id=lead.id,
        sequence_step=1,
        subject=draft.subject,
        body=draft.body,
        status="draft",
        prompt_version=PROMPT_VERSION,
    )
    db.add(db_outreach)

    # Transition Lead Stage
    lead.stage = "outreach_drafted"

    # Log Activity
    await log_activity(
        db=db,
        lead_id=lead.id,
        actor="system",
        action="outreach_drafted",
        detail={
            "subject": draft.subject,
            "prompt_version": PROMPT_VERSION,
        },
    )

    return draft
