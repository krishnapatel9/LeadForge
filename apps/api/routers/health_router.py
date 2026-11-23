from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.auth.dependencies import any_user
from apps.api.clients import ai_client
from apps.api.clients.email_client import smtp_configured
from apps.api.config import settings
from apps.api.db.session import get_db
from apps.api.models.orm.pipeline_error import PipelineError

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


def _svc(name: str, desc: str, state: str, detail: str) -> dict:
    # state: ok | not_configured | error
    return {"name": name, "description": desc, "status": state, "detail": detail}


@router.get("/system-health", dependencies=[Depends(any_user)])
async def system_health(
    probe: str | None = Query(None, description="'gemini' also makes a live call to the model"),
    db: AsyncSession = Depends(get_db),
):
    services = []

    # Database: a real round trip
    try:
        await db.execute(select(1))
        db_status = "connected"
        services.append(_svc("PostgreSQL", "Stores every lead and draft", "ok", "Connected"))
    except Exception as exc:  # noqa: BLE001
        db_status = f"error: {exc}"
        services.append(_svc("PostgreSQL", "Stores every lead and draft", "error", str(exc)[:200]))

    # Gemini: key present, plus an optional live probe
    gemini_desc = f"Writes research summaries and drafts · {settings.LEADFORGE_MODEL}"
    if not settings.GEMINI_API_KEY:
        gemini_status = "missing_key"
        services.append(_svc("Google Gemini", gemini_desc, "not_configured", "GEMINI_API_KEY not set"))
    elif probe == "gemini":
        try:
            await ai_client.probe()
            gemini_status = "configured"
            services.append(_svc("Google Gemini", gemini_desc, "ok", "Model responded"))
        except Exception as exc:  # noqa: BLE001
            gemini_status = "error"
            services.append(_svc("Google Gemini", gemini_desc, "error", str(exc)[:200]))
    else:
        gemini_status = "configured"
        services.append(_svc("Google Gemini", gemini_desc, "ok", "Key set"))

    services.append(_svc(
        "Email (SMTP)", "Sends approved outreach",
        "ok" if smtp_configured() else "not_configured",
        f"{settings.SMTP_SERVER}:{settings.SMTP_PORT}" if smtp_configured() else "Not set: approved emails are logged, not sent",
    ))
    # Apollo and Clay push leads to /leads/ingest; the API never calls them, so
    # all we can report is whether a key has been configured.
    services.append(_svc(
        "Apollo", "Finds target companies and verified contacts",
        "ok" if settings.APOLLO_API_KEY else "not_configured",
        "Key set" if settings.APOLLO_API_KEY else "APOLLO_API_KEY not set",
    ))
    services.append(_svc(
        "Clay", "Adds headcount, tech stack and company news",
        "ok" if settings.CLAY_API_KEY else "not_configured",
        "Key set" if settings.CLAY_API_KEY else "CLAY_API_KEY not set",
    ))

    try:
        err_stmt = select(func.count()).select_from(PipelineError).where(PipelineError.resolved.is_(False))
        unresolved_errors = (await db.execute(err_stmt)).scalar() or 0
    except Exception:  # noqa: BLE001
        unresolved_errors = 0

    base = settings.PUBLIC_API_URL.rstrip("/")
    # Healthy = everything the core loop needs works; optional integrations don't count.
    core_ok = db_status == "connected" and gemini_status == "configured"

    return {
        "ok": core_ok,
        "database": db_status,
        "gemini_api": gemini_status,
        "smtp": "configured" if smtp_configured() else "not_configured",
        "unresolved_pipeline_errors": unresolved_errors,
        "services": services,
        "public_api_url": base,
        "webhooks": [
            {"title": "Lead ingestion (Apollo, Clay or n8n)", "method": "POST",
             "url": f"{base}/leads/ingest", "auth": "X-API-Key header"},
            {"title": "Unsubscribe (email provider)", "method": "POST",
             "url": f"{base}/webhooks/unsubscribe", "auth": "X-API-Key header"},
        ],
    }
