from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.clients.ai_client import call_structured, MODEL
from apps.api.models.orm.lead import Lead
from apps.api.models.orm.company import Company
from apps.api.models.orm.enrichment import EnrichmentData
from apps.api.models.orm.research_brief import ResearchBrief as ORMResearchBrief
from apps.api.models.schemas import ResearchBrief as SchemaResearchBrief
from apps.api.services.activity_service import log_activity

PROMPT_VERSION = "research_brief_v1"


async def generate_research_brief(
    db: AsyncSession,
    lead: Lead,
    company: Company,
    enrichment: EnrichmentData | None
) -> SchemaResearchBrief:
    """Generates an AI research brief, persists it in Postgres, updates lead stage, and logs the activity."""
    hiring = "none"
    news = "none"
    if enrichment:
        hiring_list = enrichment.hiring_signals or []
        news_list = enrichment.news_triggers or []
        hiring = ", ".join(hiring_list) if isinstance(hiring_list, list) else str(hiring_list)
        news = ", ".join(news_list) if isinstance(news_list, list) else str(news_list)

    raw = call_structured(
        PROMPT_VERSION,
        {
            "company_name": company.name,
            "domain": company.domain,
            "industry": company.industry or "unknown",
            "employee_count": company.employee_count or "unknown",
            "revenue_band": company.revenue_band or "unknown",
            "funding_stage": company.funding_stage or "none reported",
            "tech_stack": ", ".join(company.tech_stack) if isinstance(company.tech_stack, list) else "none detected",
            "hiring_signals": hiring,
            "news_triggers": news,
            "full_name": lead.full_name,
            "title": lead.title or "unknown",
        },
    )

    brief_schema = SchemaResearchBrief(**raw)

    # Persist in DB
    db_brief = ORMResearchBrief(
        lead_id=lead.id,
        summary=brief_schema.summary,
        personalization_angles=brief_schema.personalization_angles,
        model_used=MODEL,
        prompt_version=PROMPT_VERSION,
    )
    db.add(db_brief)

    # Transition Lead Stage
    lead.stage = "researched"

    # Log Activity
    await log_activity(
        db=db,
        lead_id=lead.id,
        actor="system",
        action="lead_researched",
        detail={
            "prompt_version": PROMPT_VERSION,
            "model_used": MODEL,
            "insufficient_signal": brief_schema.insufficient_signal,
        },
    )

    return brief_schema
