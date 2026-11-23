import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.config import settings

from apps.api.routers import (
    auth_router,
    poc,
    leads_router,
    research_router,
    scoring_router,
    outreach_router,
    health_router,
    webhooks_router,
    campaigns_router,
    reports_router,
)
from apps.api.services.bootstrap import ensure_bootstrap_admin

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("leadforge.main")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Create the first admin if BOOTSTRAP_ADMIN_* is set. A database problem here
    # must not stop the API from starting (/health still has to answer).
    try:
        await ensure_bootstrap_admin()
    except Exception as exc:  # noqa: BLE001
        log.error("Bootstrap admin check failed: %s", exc)
    yield


app = FastAPI(title="LeadForge API", version="0.2.0-mvp", lifespan=lifespan)

# Only the configured dashboard origins may call the API from a browser.
# A wildcard combined with credentials let any website drive it. Set
# CORS_ORIGINS (comma-separated) for staging and production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)

# Mount all MVP routers. Every route except /health, /auth/login and the signed
# unsubscribe link requires a signed-in user or the service API key.
app.include_router(auth_router.router)
app.include_router(poc.router)
app.include_router(leads_router.router)
app.include_router(research_router.router)
app.include_router(scoring_router.router)
app.include_router(outreach_router.router)
app.include_router(health_router.router)
app.include_router(outreach_router.drafts_router)
app.include_router(webhooks_router.router)
app.include_router(campaigns_router.router)
app.include_router(reports_router.router)


