import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.auth.dependencies import Principal, pipeline_caller
from apps.api.db.session import get_db
from apps.api.models.schemas import ResearchBrief
from apps.api.routers._pipeline import fail_step, load_lead_for
from apps.api.services.research_service import generate_research_brief

router = APIRouter(prefix="/leads", tags=["research"])


@router.post("/{lead_id}/research", response_model=ResearchBrief)
async def research_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(pipeline_caller),
):
    lead, company, enrichment = await load_lead_for(db, lead_id, principal, "research")
    try:
        brief = await generate_research_brief(db=db, lead=lead, company=company, enrichment=enrichment)
        await db.commit()
        return brief
    except Exception as exc:
        raise await fail_step(db, "research", lead_id, exc, "Failed to generate research brief")
