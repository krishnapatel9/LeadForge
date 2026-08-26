import os
from fastapi import APIRouter, Depends, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.db.session import get_db
from apps.api.models.orm.pipeline_error import PipelineError

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/system-health")
async def system_health(db: AsyncSession = Depends(get_db)):
    # 1. Test database connection
    try:
        await db.execute(select(1))
        db_status = "connected"
    except Exception as exc:
        db_status = f"error: {exc}"

    # 2. Test Gemini API config
    gemini_configured = bool(os.environ.get("GEMINI_API_KEY"))
    
    # 3. Get unresolved errors count
    try:
        err_stmt = select(func.count()).select_from(PipelineError).where(PipelineError.resolved == False)
        err_res = await db.execute(err_stmt)
        unresolved_errors = err_res.scalar() or 0
    except Exception:
        unresolved_errors = 0

    return {
        "database": db_status,
        "gemini_api": "configured" if gemini_configured else "missing_key",
        "unresolved_pipeline_errors": unresolved_errors,
        "apollo_integration": "active", # Mocked for POC/MVP sequence
        "clay_integration": "active",
    }
