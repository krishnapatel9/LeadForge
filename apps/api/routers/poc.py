"""Phase 1 POC endpoint. Deliberately collapses research + score + draft into
one call (Implementation Plan, Phase 1) to prove the core loop fast. Phase 2
splits this into /leads/ingest, /leads/{id}/research, /leads/{id}/score,
/leads/{id}/draft-outreach as separate persisted steps against Postgres,
per the TRD and Backend Schema doc.
"""

import logging

from fastapi import APIRouter, HTTPException

from apps.api.clients.results_writer import append_result
from apps.api.models.schemas import LeadInput, LeadResult
from apps.api.services.outreach_service import draft_outreach
from apps.api.services.research_service import generate_research_brief
from apps.api.services.scoring_service import score_lead

router = APIRouter(prefix="/poc", tags=["poc"])
logger = logging.getLogger("leadforge.poc")


@router.post("/process-lead", response_model=LeadResult)
def process_lead(lead: LeadInput) -> LeadResult:
    research = generate_research_brief(lead)
    score = score_lead(lead, research)

    outreach = None
    if score.tier in ("hot", "warm") and not research.insufficient_signal:
        try:
            outreach = draft_outreach(lead, research)
        except ValueError as exc:
            # insufficient_signal race or model refusal — don't fail the whole
            # request, just surface the lead without a draft for human review.
            logger.warning(str(exc))

    result = LeadResult(lead=lead, research=research, score=score, outreach=outreach)

    try:
        append_result(result)
    except Exception as exc:  # noqa: BLE001 — POC-level: log, don't crash the response
        logger.error("Failed to write result to CSV: %s", exc)

    return result
