"""Phase 1 POC endpoint: a dry run of research + score + draft for one raw
payload, with nothing stored in Postgres (results go to poc_results.csv).
It uses the same prompt builders and scoring rules as the persisted pipeline
(/leads/ingest, /research, /score, /draft-outreach), so the two can't drift.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from apps.api.auth.dependencies import admin_or_service
from apps.api.clients.results_writer import append_result
from apps.api.models.schemas import LeadInput, LeadResult
from apps.api.services.outreach_service import InsufficientSignalError, draft_outreach
from apps.api.services.research_service import research_from_input
from apps.api.services.scoring_service import score_lead

router = APIRouter(prefix="/poc", tags=["poc"])
logger = logging.getLogger("leadforge.poc")


@router.post("/process-lead", response_model=LeadResult, dependencies=[Depends(admin_or_service)])
async def process_lead(lead: LeadInput) -> LeadResult:
    try:
        research = await research_from_input(lead)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Research failed: {exc}")

    score = score_lead(lead, research)

    outreach = None
    if score.tier in ("hot", "warm") and not research.insufficient_signal:
        try:
            outreach = await draft_outreach(lead, research)
        except InsufficientSignalError as exc:
            logger.warning(str(exc))
        except Exception as exc:  # noqa: BLE001 - surface the lead without a draft
            logger.warning("Draft failed for POC lead: %s", exc)

    result = LeadResult(lead=lead, research=research, score=score, outreach=outreach)

    try:
        append_result(result)
    except Exception as exc:  # noqa: BLE001 — POC-level: log, don't crash the response
        logger.error("Failed to write result to CSV: %s", exc)

    return result
