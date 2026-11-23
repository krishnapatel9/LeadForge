import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.auth.dependencies import Principal, any_user, ensure_same_org, ingest_caller
from apps.api.db.session import get_db
from apps.api.models.orm.organization import Organization
from apps.api.models.orm.company import Company
from apps.api.models.orm.lead import Lead
from apps.api.models.orm.enrichment import EnrichmentData
from apps.api.models.orm.lead_score import LeadScore
from apps.api.services.score_queries import latest_score_subquery
from apps.api.models.orm.research_brief import ResearchBrief
from apps.api.models.orm.outreach_message import OutreachMessage
from apps.api.models.schemas import (
    LeadInput,
    IngestionResult,
    LeadListItem,
    LeadDetail,
    LeadOut,
    CompanyOut,
    ResearchBrief as ResearchBriefSchema,
    ScoreBreakdown,
    OutreachMessageOut,
    EnrichmentOut,
)
from apps.api.services.dedupe_service import check_company_duplicate, check_lead_duplicate
from apps.api.services.activity_service import log_activity
from apps.api.services.lead_state import allowed_actions

router = APIRouter(prefix="/leads", tags=["leads"])

# Stages a stale re-ingest may send back to "new" for fresh research. Leads past
# these (contacted, replied, booked, won, lost, unsubscribed) keep their stage.
RESEARCHABLE_STAGES = {"new", "enriched", "researched", "scored", "outreach_drafted"}


@router.post(
    "/ingest",
    response_model=IngestionResult,
    status_code=status.HTTP_201_CREATED,
)
async def ingest_lead(
    lead_in: LeadInput,
    db: AsyncSession = Depends(get_db),
    principal: Principal | None = Depends(ingest_caller),
):
    # 1. Resolve the organisation: a signed-in user ingests into their own org;
    #    the automation key (which has no user) uses the default org.
    org_id = getattr(principal, "org_id", None)
    if org_id is None:
        org_result = await db.execute(select(Organization).limit(1))
        org = org_result.scalars().first()
        if not org:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No organization seeded. Ensure database initialization is complete.",
            )
        org_id = org.id

    # 2. Check for duplicate lead
    is_dup, existing_lead, existing_enrichment = await check_lead_duplicate(db, lead_in.email)

    # An opted-out contact is never re-activated by a new ingest (CAN-SPAM):
    # skip it entirely so no field, stage or flag is touched.
    # Emails are unique across the whole database, so a lead owned by another
    # organisation can't be created or refreshed from here.
    if existing_lead and getattr(existing_lead, "org_id", org_id) != org_id:
        return IngestionResult(status="skipped", reason="exists_in_other_org", lead_id=existing_lead.id)

    if existing_lead and existing_lead.do_not_contact:
        return IngestionResult(
            status="skipped",
            reason="do_not_contact",
            lead_id=existing_lead.id,
        )

    if is_dup and existing_lead:
        return IngestionResult(
            status="skipped",
            reason="recent_duplicate",
            lead_id=existing_lead.id,
        )

    # 3. Resolve Company
    is_comp_dup, company = await check_company_duplicate(db, lead_in.domain)
    if not company:
        # Create new company
        company = Company(
            org_id=org_id,
            domain=lead_in.domain,
            name=lead_in.company_name,
            industry=lead_in.industry,
            employee_count=lead_in.employee_count,
            revenue_band=lead_in.revenue_band,
            funding_stage=lead_in.funding_stage,
            tech_stack=lead_in.tech_stack,
            source="apollo",
        )
        db.add(company)
        await db.flush()  # gets company.id
    elif not is_comp_dup and getattr(company, "org_id", org_id) == org_id:
        # Stale company, update firmographics and move the refresh time
        company.enriched_at = func.now()
        company.name = lead_in.company_name
        company.industry = lead_in.industry
        company.employee_count = lead_in.employee_count
        company.revenue_band = lead_in.revenue_band
        company.funding_stage = lead_in.funding_stage
        company.tech_stack = lead_in.tech_stack

    # 4. Resolve Lead
    if existing_lead:
        # Existing stale lead: refresh its data. do_not_contact is never changed
        # here (opted-out leads were skipped above), and a lead that has already
        # been contacted keeps its pipeline stage instead of falling back to "new".
        existing_lead.full_name = lead_in.full_name
        existing_lead.title = lead_in.title
        existing_lead.linkedin_url = lead_in.linkedin_url
        existing_lead.email_verified = lead_in.email_verified
        if existing_lead.stage in RESEARCHABLE_STAGES:
            existing_lead.stage = "new"
        lead = existing_lead
    else:
        # Create new lead
        lead = Lead(
            org_id=org_id,
            company_id=company.id,
            campaign_id=lead_in.campaign_id,
            full_name=lead_in.full_name,
            title=lead_in.title,
            email=lead_in.email,
            linkedin_url=lead_in.linkedin_url,
            email_verified=lead_in.email_verified,
            stage="new",
            do_not_contact=False,
        )
        db.add(lead)
        await db.flush()

    # 5. Save/Update enrichment data specifically for lead
    enrich = existing_enrichment

    # We parse hiring signals and news triggers from raw input keys
    hiring = lead_in.hiring_signals
    news = lead_in.news_triggers

    if enrich:
        enrich.hiring_signals = hiring
        enrich.news_triggers = news
        # Staleness is measured from this timestamp, so a refresh must move it
        enrich.enriched_at = func.now()
    else:
        enrich = EnrichmentData(
            lead_id=lead.id,
            hiring_signals=hiring,
            news_triggers=news,
        )
        db.add(enrich)

    # 6. Log Activity
    await log_activity(
        db=db,
        lead_id=lead.id,
        actor="system",
        action="lead_ingested",
        detail={
            "email": lead.email,
            "company_domain": company.domain,
            "was_stale": existing_lead is not None,
        },
    )

    await db.commit()

    return IngestionResult(status="ingested", lead_id=lead.id)


@router.get("", response_model=list[LeadListItem])
async def list_leads(
    stage: str | None = None,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(any_user),
):
    # Latest score per lead in one query (was one extra query per lead)
    latest_score = latest_score_subquery()
    stmt = (
        select(Lead, Company, latest_score.c.tier, latest_score.c.total_score)
        .join(Company, Lead.company_id == Company.id)
        .outerjoin(latest_score, latest_score.c.lead_id == Lead.id)
        .where(Lead.org_id == principal.org_id)
    )
    if stage:
        stmt = stmt.where(Lead.stage == stage)
    stmt = stmt.order_by(Lead.created_at.desc())

    result = await db.execute(stmt)
    return [
        LeadListItem(
            id=lead.id,
            full_name=lead.full_name,
            title=lead.title,
            email=lead.email,
            stage=lead.stage,
            do_not_contact=lead.do_not_contact,
            company_name=company.name,
            company_domain=company.domain,
            created_at=lead.created_at,
            tier=tier,
            total_score=total_score,
        )
        for lead, company, tier, total_score in result.all()
    ]


@router.get("/{lead_id}", response_model=LeadDetail)
async def get_lead_detail(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(any_user),
):
    # Fetch lead and company
    stmt = select(Lead, Company).join(Company, Lead.company_id == Company.id).where(Lead.id == lead_id)
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with id {lead_id} not found."
        )
    lead, company = row
    ensure_same_org(principal, lead.org_id)

    # Fetch latest score
    score_stmt = (
        select(LeadScore)
        .where(LeadScore.lead_id == lead.id)
        .order_by(LeadScore.created_at.desc())
        .limit(1)
    )
    score_result = await db.execute(score_stmt)
    latest_score = score_result.scalars().first()

    # Fetch latest research brief
    brief_stmt = (
        select(ResearchBrief)
        .where(ResearchBrief.lead_id == lead.id)
        .order_by(ResearchBrief.created_at.desc())
        .limit(1)
    )
    brief_result = await db.execute(brief_stmt)
    latest_brief = brief_result.scalars().first()

    # Fetch outreach messages
    outreach_stmt = (
        select(OutreachMessage)
        .where(OutreachMessage.lead_id == lead.id)
        .order_by(OutreachMessage.sequence_step.asc(), OutreachMessage.created_at.desc())
    )
    outreach_result = await db.execute(outreach_stmt)
    messages = outreach_result.scalars().all()

    enrichment_result = await db.execute(select(EnrichmentData).where(EnrichmentData.lead_id == lead.id))
    enrichment = enrichment_result.scalars().first()

    # Map to schema models
    lead_out = LeadOut(
        id=lead.id,
        org_id=lead.org_id,
        company_id=lead.company_id,
        campaign_id=lead.campaign_id,
        full_name=lead.full_name,
        title=lead.title,
        email=lead.email,
        linkedin_url=lead.linkedin_url,
        email_verified=lead.email_verified,
        stage=lead.stage,
        do_not_contact=lead.do_not_contact,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )

    company_out = CompanyOut(
        id=company.id,
        domain=company.domain,
        name=company.name,
        industry=company.industry,
        employee_count=company.employee_count,
        revenue_band=company.revenue_band,
        funding_stage=company.funding_stage,
        tech_stack=company.tech_stack,
        source=company.source,
        created_at=company.created_at,
    )

    research_out = None
    if latest_brief:
        # We need to map personalization_angles if it's stored as JSONB list
        research_out = ResearchBriefSchema(
            summary=latest_brief.summary,
            personalization_angles=latest_brief.personalization_angles,
            insufficient_signal=bool(latest_brief.insufficient_signal),
        )

    score_out = None
    if latest_score:
        score_out = ScoreBreakdown(
            fit_score=latest_score.fit_score,
            intent_score=latest_score.intent_score,
            gap_score=latest_score.gap_score,
            contactability_score=latest_score.contactability_score,
            engagement_score=latest_score.engagement_score,
            total_score=latest_score.total_score,
            tier=latest_score.tier,
        )

    outreach_out = [
        OutreachMessageOut(
            id=m.id,
            sequence_step=m.sequence_step,
            subject=m.subject,
            body=m.body,
            status=m.status,
            sent_at=m.sent_at,
            opened_at=m.opened_at,
            replied_at=m.replied_at,
            bounced=m.bounced,
            prompt_version=m.prompt_version,
            created_at=m.created_at,
        )
        for m in messages
    ]

    enrichment_out = None
    if enrichment:
        enrichment_out = EnrichmentOut(
            hiring_signals=enrichment.hiring_signals or [],
            news_triggers=enrichment.news_triggers or [],
            enriched_at=enrichment.enriched_at,
        )

    return LeadDetail(
        lead=lead_out,
        company=company_out,
        enrichment=enrichment_out,
        research=research_out,
        score=score_out,
        outreach=outreach_out,
        allowed_actions=allowed_actions(lead.stage, lead.do_not_contact),
    )
