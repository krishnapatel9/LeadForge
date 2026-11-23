"""Shared plumbing for the pipeline step routes (research, score, draft)."""

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.auth.dependencies import Principal, ensure_same_org
from apps.api.models.orm.company import Company
from apps.api.models.orm.enrichment import EnrichmentData
from apps.api.models.orm.lead import Lead
from apps.api.models.orm.pipeline_error import PipelineError
from apps.api.services.lead_state import require_transition

logger = logging.getLogger("leadforge.pipeline")


async def load_lead_for(
    db: AsyncSession, lead_id: uuid.UUID, principal: Principal, action: str, *, lock: bool = False
) -> tuple[Lead, Company, EnrichmentData | None]:
    """Fetches the lead, its company and enrichment, and checks that `action` is allowed."""
    stmt = select(Lead).where(Lead.id == lead_id)
    if lock:
        stmt = stmt.with_for_update()
    lead = (await db.execute(stmt)).scalars().first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Lead with id {lead_id} not found")
    ensure_same_org(principal, lead.org_id)
    require_transition(lead, action)

    company = (await db.execute(select(Company).where(Company.id == lead.company_id))).scalars().first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with id {lead.company_id} not found for lead {lead_id}",
        )
    enrichment = (
        await db.execute(select(EnrichmentData).where(EnrichmentData.lead_id == lead_id))
    ).scalars().first()
    return lead, company, enrichment


async def fail_step(db: AsyncSession, stage: str, lead_id: uuid.UUID, exc: Exception, detail: str) -> HTTPException:
    """Rolls back, records the failure in pipeline_errors (shown on Integrations) and
    returns the HTTP error to raise. Upstream AI/email failures are 502, not 500."""
    await db.rollback()
    # The user sees the short message; the log and pipeline_errors keep the raw provider error
    raw = f"{exc} | cause: {exc.__cause__}" if exc.__cause__ else str(exc)
    logger.error("%s failed for lead %s: %s", stage, lead_id, raw)
    try:
        db.add(PipelineError(stage=stage, payload={"lead_id": str(lead_id)}, error_message=raw[:2000]))
        await db.commit()
    except Exception:  # noqa: BLE001 - recording the error must never hide it
        await db.rollback()
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"{detail}: {exc}")
