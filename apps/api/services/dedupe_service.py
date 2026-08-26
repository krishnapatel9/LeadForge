from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from apps.api.models.orm.company import Company
from apps.api.models.orm.lead import Lead

async def check_company_duplicate(db: AsyncSession, domain: str) -> tuple[bool, Company | None]:
    """Checks if a company with the given domain exists and is not stale.
    Returns (is_duplicate_and_recent, company).
    If it exists but was created > 90 days ago, it is considered stale, so not a skip duplicate.
    """
    stmt = select(Company).where(Company.domain == domain)
    result = await db.execute(stmt)
    company = result.scalars().first()
    if not company:
        return False, None
    
    # Check if stale (>90 days old)
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    # Ensure company.created_at is timezone-aware for comparison
    created_at = company.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
        
    if created_at < cutoff:
        return False, company  # Exists but stale, needs re-enrichment
    return True, company  # Recent duplicate

async def check_lead_duplicate(db: AsyncSession, email: str) -> tuple[bool, Lead | None]:
    """Checks if a lead with the given email exists and is not stale.
    Returns (is_duplicate_and_recent, lead).
    """
    stmt = select(Lead).where(Lead.email == email)
    result = await db.execute(stmt)
    lead = result.scalars().first()
    if not lead:
        return False, None
    
    # Check if stale (>90 days old)
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    created_at = lead.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
        
    if created_at < cutoff:
        return False, lead  # Stale
    return True, lead  # Recent duplicate
