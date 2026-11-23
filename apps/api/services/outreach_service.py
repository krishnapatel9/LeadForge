from urllib.parse import urlencode

from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.auth.security import unsubscribe_token
from apps.api.config import settings
from sqlalchemy import update
from apps.api.clients.ai_client import call_structured
from apps.api.models.schemas import LeadInput, OutreachDraft, ResearchBrief as SchemaResearchBrief
from apps.api.models.orm.lead import Lead as ORMLead
from apps.api.models.orm.company import Company as ORMCompany
from apps.api.models.orm.research_brief import ResearchBrief as ORMResearchBrief
from apps.api.models.orm.outreach_message import OutreachMessage as ORMOutreachMessage
from apps.api.services.activity_service import log_activity
from apps.api.services.lead_state import advance

PROMPT_VERSION = "outreach_draft_v1"


def unsubscribe_url(email: str) -> str:
    """Signed one-click opt-out link for this recipient (only works for this address)."""
    query = urlencode({"email": email, "token": unsubscribe_token(email)})
    return f"{settings.PUBLIC_API_URL.rstrip('/')}/webhooks/unsubscribe?{query}"


def with_compliance_footer(body: str, email: str) -> str:
    """CAN-SPAM: every commercial email carries an opt-out link and a postal address."""
    return (
        f"{body.rstrip()}\n\n--\n"
        f"{settings.AGENCY_POSTAL_ADDRESS}\n"
        f"Don't want these emails? Unsubscribe: {unsubscribe_url(email)}\n"
    )

# TODO: move to config/env once this needs to vary per agency/campaign.
AGENCY_CONTEXT = (
    "We are a digital marketing agency specializing in paid acquisition and "
    "content strategy for growth-stage B2B SaaS and DTC brands."
)


class InsufficientSignalError(ValueError):
    """The research brief said there isn't enough to personalise; a human must review."""


def _angles(value) -> str:
    return "; ".join(value) if isinstance(value, list) else str(value or "")


def build_outreach_vars(*, full_name, title, company_name, summary, angles) -> dict:
    """The prompt variables, shared by the database pipeline and the POC dry run."""
    return {
        "agency_context": AGENCY_CONTEXT,
        "full_name": full_name,
        "title": title or "unknown",
        "company_name": company_name,
        "research_summary": summary,
        "personalization_angles": _angles(angles),
    }


async def draft_outreach(lead: LeadInput, research: SchemaResearchBrief) -> OutreachDraft:
    """Draft for a raw payload, without touching the database (POC dry run)."""
    if research.insufficient_signal:
        raise InsufficientSignalError(
            f"Refusing to draft outreach for {lead.email}: research brief "
            "flagged insufficient_signal — needs human review, not a generic draft."
        )
    raw = await call_structured(
        PROMPT_VERSION,
        build_outreach_vars(
            full_name=lead.full_name, title=lead.title, company_name=lead.company_name,
            summary=research.summary, angles=research.personalization_angles,
        ),
    )
    return OutreachDraft(**raw)


async def draft_outreach_db(
    db: AsyncSession,
    lead: ORMLead,
    company: ORMCompany,
    research: ORMResearchBrief,
) -> OutreachDraft:
    """Drafts, persists the message as a draft, advances the lead and logs it.
    The caller has already checked the transition (services/lead_state.py)."""
    if getattr(research, "insufficient_signal", False):
        raise InsufficientSignalError(
            "The research brief flagged insufficient signal for this lead. "
            "Review it by hand instead of sending a generic draft."
        )

    raw = await call_structured(
        PROMPT_VERSION,
        build_outreach_vars(
            full_name=lead.full_name, title=lead.title, company_name=company.name,
            summary=research.summary, angles=research.personalization_angles,
        ),
    )
    draft = OutreachDraft(**raw)

    # Re-drafting replaces the pending draft instead of piling up several
    await db.execute(
        update(ORMOutreachMessage)
        .where(ORMOutreachMessage.lead_id == lead.id, ORMOutreachMessage.status == "draft")
        .values(status="rejected")
    )
    db.add(ORMOutreachMessage(
        lead_id=lead.id,
        sequence_step=1,
        subject=draft.subject,
        body=draft.body,
        status="draft",
        prompt_version=PROMPT_VERSION,
    ))
    advance(lead, "draft")

    await log_activity(
        db=db,
        lead_id=lead.id,
        actor="system",
        action="outreach_drafted",
        detail={"subject": draft.subject, "prompt_version": PROMPT_VERSION},
    )
    return draft
