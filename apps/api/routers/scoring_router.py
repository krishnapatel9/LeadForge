import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.auth.dependencies import Principal, pipeline_caller
from apps.api.db.session import get_db
from apps.api.models.schemas import ScoreBreakdown
from apps.api.routers._pipeline import fail_step, load_lead_for
from apps.api.services.scoring_service import score_lead_db

router = APIRouter(prefix="/leads", tags=["scoring"])


@router.post("/{lead_id}/score", response_model=ScoreBreakdown)
async def score_lead_endpoint(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(pipeline_caller),
):
    lead, company, enrichment = await load_lead_for(db, lead_id, principal, "score")
    try:
        score = await score_lead_db(db=db, lead=lead, company=company, enrichment=enrichment)
        await db.commit()
        return score
    except Exception as exc:
        raise await fail_step(db, "score", lead_id, exc, "Failed to score lead")
