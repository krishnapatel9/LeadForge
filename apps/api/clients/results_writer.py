"""Phase 1 POC output sink. Defaults to a local CSV so the loop is runnable
with zero extra setup. Swap this for the Google Sheets API or Airtable API
client when you're ready to run the real n8n workflow (Implementation Plan,
Phase 1 step 1) — the LeadResult shape stays the same either way.
"""

import csv
from pathlib import Path

from apps.api.models.schemas import LeadResult

OUTPUT_PATH = Path(__file__).parent.parent.parent.parent / "poc_results.csv"

FIELDNAMES = [
    "full_name", "title", "company_name", "domain", "email",
    "total_score", "tier",
    "fit_score", "intent_score", "gap_score", "contactability_score", "engagement_score",
    "research_summary", "personalization_angles", "insufficient_signal",
    "outreach_subject", "outreach_body", "prompt_version",
]


def append_result(result: LeadResult) -> None:
    is_new_file = not OUTPUT_PATH.exists()
    with OUTPUT_PATH.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        if is_new_file:
            writer.writeheader()
        writer.writerow({
            "full_name": result.lead.full_name,
            "title": result.lead.title,
            "company_name": result.lead.company_name,
            "domain": result.lead.domain,
            "email": result.lead.email,
            "total_score": result.score.total_score,
            "tier": result.score.tier,
            "fit_score": result.score.fit_score,
            "intent_score": result.score.intent_score,
            "gap_score": result.score.gap_score,
            "contactability_score": result.score.contactability_score,
            "engagement_score": result.score.engagement_score,
            "research_summary": result.research.summary,
            "personalization_angles": "; ".join(result.research.personalization_angles),
            "insufficient_signal": result.research.insufficient_signal,
            "outreach_subject": result.outreach.subject if result.outreach else "",
            "outreach_body": result.outreach.body if result.outreach else "",
            "prompt_version": result.prompt_version,
        })
