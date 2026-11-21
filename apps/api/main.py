import logging

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
)

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="LeadForge API", version="0.2.0-mvp")

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
app.include_router(webhooks_router.router)


