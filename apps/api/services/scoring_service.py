"""Deterministic lead scoring, per PRD §8."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from apps.api.models.schemas import LeadInput, ScoreBreakdown
from apps.api.models.orm.lead import Lead as ORMLead
from apps.api.models.orm.company import Company as ORMCompany
from apps.api.models.orm.enrichment import EnrichmentData as ORMEnrichmentData
from apps.api.models.orm.lead_score import LeadScore as ORMLeadScore
from apps.api.models.orm.outreach_message import OutreachMessage as ORMOutreachMessage
from apps.api.services.activity_service import log_activity
from apps.api.services.lead_state import advance

ICP_INDUSTRIES = {"saas", "software", "e-commerce", "dtc", "ecommerce"}
ICP_EMPLOYEE_RANGE = (20, 200)

def _fit_score(industry: str | None, employee_count: int | None) -> int:
    score = 0
    if industry and industry.strip().lower() in ICP_INDUSTRIES:
        score += 15
    elif industry:
        score += 5

    if employee_count is not None:
        low, high = ICP_EMPLOYEE_RANGE
        if low <= employee_count <= high:
            score += 15
        elif employee_count > 0:
            score += 5

    return min(score, 30)

def _intent_score(funding_stage: str | None, hiring_signals: list[str]) -> int:
    score = 0
    if funding_stage:
        score += 8
    if hiring_signals:
        score += min(8 * len(hiring_signals), 17)
    return min(score, 25)

def _gap_score(hiring_signals: list[str], news_triggers: list[str]) -> int:
    score = 0
    if any("market" in s.lower() or "growth" in s.lower() for s in hiring_signals):
        score += 12
    if news_triggers:
        score += 8
    return min(score, 20)

def _contactability_score(email_verified: bool, linkedin_url: str | None) -> int:
    score = 0
    if email_verified:
        score += 8
    if linkedin_url:
        score += 7
    return min(score, 15)

def _tier(total: int) -> str:
    if total >= 70:
        return "hot"
    if total >= 40:
        return "warm"
    return "cool"

# Synchronous Pydantic function for the original unit tests
def score_lead(lead: LeadInput, research = None) -> ScoreBreakdown:
    fit = _fit_score(lead.industry, lead.employee_count)
    intent = _intent_score(lead.funding_stage, lead.hiring_signals)
    gap = _gap_score(lead.hiring_signals, lead.news_triggers)
    contactability = _contactability_score(lead.email_verified, lead.linkedin_url)
    engagement = 10 if lead.has_prior_engagement else 0
    total = fit + intent + gap + contactability + engagement

    return ScoreBreakdown(
        fit_score=fit,
        intent_score=intent,
        gap_score=gap,
        contactability_score=contactability,
        engagement_score=engagement,
        total_score=total,
        tier=_tier(total),
    )

# Async function for our DB pipeline
async def score_lead_db(
    db: AsyncSession,
    lead: ORMLead,
    company: ORMCompany,
    enrichment: ORMEnrichmentData | None
) -> ScoreBreakdown:
    fit = _fit_score(company.industry, company.employee_count)
    
    funding_stage = company.funding_stage
    hiring_signals = []
    news_triggers = []
    if enrichment:
        hiring_signals = enrichment.hiring_signals or []
        news_triggers = enrichment.news_triggers or []
        
    intent = _intent_score(funding_stage, hiring_signals)
    gap = _gap_score(hiring_signals, news_triggers)
    contactability = _contactability_score(lead.email_verified, lead.linkedin_url)
    
    # Check prior engagement from outreach messages count
    stmt = select(ORMOutreachMessage).where(
        ORMOutreachMessage.lead_id == lead.id,
        ORMOutreachMessage.status == 'sent'
    ).limit(1)
    result = await db.execute(stmt)
    has_sent_msg = result.scalars().first() is not None
    engagement = 10 if has_sent_msg else 0
    
    total = fit + intent + gap + contactability + engagement
    tier = _tier(total)
    
    # Save to lead_scores
    score_orm = ORMLeadScore(
        lead_id=lead.id,
        fit_score=fit,
        intent_score=intent,
        gap_score=gap,
        contactability_score=contactability,
        engagement_score=engagement,
        total_score=total,
        tier=tier,
        scoring_version="v1",
    )
    db.add(score_orm)
    
    advance(lead, "score")
    
    # Log Activity
    await log_activity(
        db=db,
        lead_id=lead.id,
        actor="system",
        action="lead_scored",
        detail={
            "total_score": total,
            "tier": tier,
            "fit_score": fit,
            "intent_score": intent,
            "gap_score": gap,
            "contactability_score": contactability,
            "engagement_score": engagement,
        }
    )
    
    return ScoreBreakdown(
        fit_score=fit,
        intent_score=intent,
        gap_score=gap,
        contactability_score=contactability,
        engagement_score=engagement,
        total_score=total,
        tier=tier,
    )
