import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.routers import (
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

# Enable CORS for the dashboard app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the actual dashboard origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all MVP routers
app.include_router(poc.router)
app.include_router(leads_router.router)
app.include_router(research_router.router)
app.include_router(scoring_router.router)
app.include_router(outreach_router.router)
app.include_router(health_router.router)
app.include_router(webhooks_router.router)


