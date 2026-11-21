from datetime import datetime, timedelta, timezone
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from apps.api.models.orm.company import Company
from apps.api.models.orm.enrichment import EnrichmentData
from apps.api.models.orm.lead import Lead

STALE_AFTER = timedelta(days=90)


def _is_stale(refreshed_at: datetime, now: datetime | None = None) -> bool:
    """True when data was last refreshed more than STALE_AFTER ago."""
    now = now or datetime.now(timezone.utc)
    if refreshed_at.tzinfo is None:
        refreshed_at = refreshed_at.replace(tzinfo=timezone.utc)
    return refreshed_at < now - STALE_AFTER


async def check_company_duplicate(db: AsyncSession, domain: str) -> tuple[bool, Company | None]:
    """Checks if a company with the given domain exists and is not stale.
    Returns (is_duplicate_and_recent, company).
    If it exists but was created > 90 days ago, it is considered stale, so not a skip duplicate.
    """
    stmt = select(Company).where(func.lower(Company.domain) == domain)
    result = await db.execute(stmt)
    company = result.scalars().first()
    if not company:
        return False, None

    if _is_stale(company.created_at):
        return False, company  # Exists but stale, needs re-enrichment
    return True, company  # Recent duplicate


async def check_lead_duplicate(
    db: AsyncSession, email: str
) -> tuple[bool, Lead | None, EnrichmentData | None]:
    """Checks if a lead with the given (normalised) email exists and is not stale.
    Returns (is_duplicate_and_recent, lead, enrichment).

    Staleness is measured from the last enrichment refresh, not from when the lead
    was created. Measuring from created_at meant that once a lead was 90 days old,
    every later ingest counted as stale and reset it, because a refresh never
    changes created_at.
    """
    stmt = (
        select(Lead, EnrichmentData)
        .outerjoin(EnrichmentData, EnrichmentData.lead_id == Lead.id)
        .where(func.lower(Lead.email) == email)
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        return False, None, None
    lead, enrichment = row

    refreshed_at = enrichment.enriched_at if enrichment else lead.created_at
    if _is_stale(refreshed_at):
        return False, lead, enrichment  # Stale
    return True, lead, enrichment  # Recent duplicate
