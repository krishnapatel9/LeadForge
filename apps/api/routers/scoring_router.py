import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.auth.dependencies import Principal, ensure_same_org, pipeline_caller
from apps.api.db.session import get_db
from apps.api.models.orm.lead import Lead
from apps.api.models.orm.company import Company
from apps.api.models.orm.enrichment import EnrichmentData
from apps.api.models.schemas import ScoreBreakdown
from apps.api.services.scoring_service import score_lead_db

router = APIRouter(prefix="/leads", tags=["scoring"])


@router.post("/{lead_id}/score", response_model=ScoreBreakdown)
async def score_lead_endpoint(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(pipeline_caller),
):
    # 1. Fetch Lead
    lead_stmt = select(Lead).where(Lead.id == lead_id)
    lead_res = await db.execute(lead_stmt)
    lead = lead_res.scalars().first()
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with id {lead_id} not found",
        )
    ensure_same_org(principal, lead.org_id)

    # 2. Fetch Company
    company_stmt = select(Company).where(Company.id == lead.company_id)
    company_res = await db.execute(company_stmt)
    company = company_res.scalars().first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with id {lead.company_id} not found for lead {lead_id}",
        )

    # 3. Fetch Enrichment Data
    enrichment_stmt = select(EnrichmentData).where(EnrichmentData.lead_id == lead_id)
    enrichment_res = await db.execute(enrichment_stmt)
    enrichment = enrichment_res.scalars().first()

    # 4. Score lead
    try:
        scoreObj = await score_lead_db(
            db=db,
            lead=lead,
            company=company,
            enrichment=enrichment,
        )
        await db.commit()
        return scoreObj
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to score lead: {exc}",
        )
