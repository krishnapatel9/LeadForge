from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.clients.ai_client import MODEL, call_structured
from apps.api.models.orm.company import Company
from apps.api.models.orm.enrichment import EnrichmentData
from apps.api.models.orm.lead import Lead
from apps.api.models.orm.research_brief import ResearchBrief as ORMResearchBrief
from apps.api.models.schemas import LeadInput, ResearchBrief as SchemaResearchBrief
from apps.api.services.activity_service import log_activity
from apps.api.services.lead_state import advance

PROMPT_VERSION = "research_brief_v1"


def _join(values) -> str:
    if isinstance(values, list):
        return ", ".join(str(v) for v in values) or "none"
    return str(values) if values else "none"


def build_research_vars(
    *, company_name, domain, industry, employee_count, revenue_band, funding_stage,
    tech_stack, hiring_signals, news_triggers, full_name, title,
) -> dict:
    """The prompt variables, shared by the database pipeline and the POC dry run."""
    return {
        "company_name": company_name,
        "domain": domain,
        "industry": industry or "unknown",
        "employee_count": employee_count or "unknown",
        "revenue_band": revenue_band or "unknown",
        "funding_stage": funding_stage or "none reported",
        "tech_stack": _join(tech_stack) if tech_stack else "none detected",
        "hiring_signals": _join(hiring_signals),
        "news_triggers": _join(news_triggers),
        "full_name": full_name,
        "title": title or "unknown",
    }


async def research_from_input(lead: LeadInput) -> SchemaResearchBrief:
    """Research brief for a raw payload, without touching the database (POC)."""
    raw = await call_structured(
        PROMPT_VERSION,
        build_research_vars(
            company_name=lead.company_name, domain=lead.domain, industry=lead.industry,
            employee_count=lead.employee_count, revenue_band=lead.revenue_band,
            funding_stage=lead.funding_stage, tech_stack=lead.tech_stack,
            hiring_signals=lead.hiring_signals, news_triggers=lead.news_triggers,
            full_name=lead.full_name, title=lead.title,
        ),
    )
    return SchemaResearchBrief(**raw)


async def generate_research_brief(
    db: AsyncSession,
    lead: Lead,
    company: Company,
    enrichment: EnrichmentData | None,
) -> SchemaResearchBrief:
    """Generates an AI research brief, persists it, advances the lead and logs it.
    The caller has already checked the transition (services/lead_state.py)."""
    raw = await call_structured(
        PROMPT_VERSION,
        build_research_vars(
            company_name=company.name, domain=company.domain, industry=company.industry,
            employee_count=company.employee_count, revenue_band=company.revenue_band,
            funding_stage=company.funding_stage, tech_stack=company.tech_stack,
            hiring_signals=enrichment.hiring_signals if enrichment else None,
            news_triggers=enrichment.news_triggers if enrichment else None,
            full_name=lead.full_name, title=lead.title,
        ),
    )
    brief_schema = SchemaResearchBrief(**raw)

    db.add(ORMResearchBrief(
        lead_id=lead.id,
        summary=brief_schema.summary,
        personalization_angles=brief_schema.personalization_angles,
        insufficient_signal=brief_schema.insufficient_signal,
        model_used=MODEL,
        prompt_version=PROMPT_VERSION,
    ))
    advance(lead, "research")

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
