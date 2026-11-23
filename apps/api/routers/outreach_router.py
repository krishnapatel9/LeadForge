import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.auth.dependencies import Principal, any_user, approver, ensure_same_org, pipeline_caller
from apps.api.clients.email_client import send_email
from apps.api.db.session import get_db
from apps.api.models.orm.company import Company
from apps.api.models.orm.lead import Lead
from apps.api.services.score_queries import latest_score_subquery
from apps.api.models.orm.outreach_message import OutreachMessage
from apps.api.models.orm.research_brief import ResearchBrief
from apps.api.models.schemas import OutreachDraft
from apps.api.routers._pipeline import fail_step, load_lead_for
from apps.api.services.activity_service import log_activity
from apps.api.services.lead_state import advance, require_transition
from apps.api.services.outreach_service import (
    InsufficientSignalError,
    draft_outreach_db,
    unsubscribe_url,
    with_compliance_footer,
)

router = APIRouter(prefix="/leads", tags=["outreach"])
drafts_router = APIRouter(prefix="/outreach", tags=["outreach"])


@router.post("/{lead_id}/draft-outreach", response_model=OutreachDraft)
async def draft_outreach_endpoint(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(pipeline_caller),
):
    lead, company, _ = await load_lead_for(db, lead_id, principal, "draft")

    brief = (
        await db.execute(
            select(ResearchBrief)
            .where(ResearchBrief.lead_id == lead_id)
            .order_by(ResearchBrief.created_at.desc())
            .limit(1)
        )
    ).scalars().first()
    if not brief:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Research brief must be generated before drafting outreach.",
        )

    try:
        draft = await draft_outreach_db(db=db, lead=lead, company=company, research=brief)
        await db.commit()
        return draft
    except InsufficientSignalError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        raise await fail_step(db, "draft", lead_id, exc, "Failed to generate outreach draft")


class OutreachApprovalPayload(BaseModel):
    """Edits made in the dashboard. Omitted fields keep the stored draft text;
    a provided field must not be blank (an empty editor must never send)."""

    subject: str | None = Field(default=None, max_length=300)
    body: str | None = Field(default=None, max_length=10000)

    @field_validator("subject", "body")
    @classmethod
    def _not_blank(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("must not be empty")
        return value


async def _latest_draft(db: AsyncSession, lead_id: uuid.UUID, lock: bool = False) -> OutreachMessage:
    stmt = (
        select(OutreachMessage)
        .where(OutreachMessage.lead_id == lead_id, OutreachMessage.status == "draft")
        .order_by(OutreachMessage.created_at.desc())
        .limit(1)
    )
    if lock:
        # Lock the draft so two approvals at once can't both send it
        stmt = stmt.with_for_update()
    msg = (await db.execute(stmt)).scalars().first()
    if not msg:
        raise HTTPException(status_code=404, detail="No draft outreach message found for this lead.")
    return msg


async def _lead_for_decision(db: AsyncSession, lead_id: uuid.UUID, principal: Principal, action: str) -> Lead:
    lead = (await db.execute(select(Lead).where(Lead.id == lead_id))).scalars().first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    ensure_same_org(principal, lead.org_id)
    require_transition(lead, action)
    return lead


@router.post("/{lead_id}/outreach/approve")
async def approve_outreach(
    lead_id: uuid.UUID,
    payload: OutreachApprovalPayload | None = None,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(approver),
):
    lead = await _lead_for_decision(db, lead_id, principal, "approve")
    msg = await _latest_draft(db, lead_id, lock=True)

    if payload:
        if payload.subject is not None:
            msg.subject = payload.subject.strip()
        if payload.body is not None:
            msg.body = payload.body

    # The unsubscribe footer and headers are added at send time (not stored), so
    # every message carries a valid signed opt-out link.
    try:
        transport = await send_email(
            to_email=lead.email,
            subject=msg.subject,
            body=with_compliance_footer(msg.body, lead.email),
            unsubscribe_url=unsubscribe_url(lead.email),
        )
    except Exception as exc:
        # The draft stays a draft (edits discarded) so it can be retried.
        raise await fail_step(db, "send", lead_id, exc, "Email could not be sent; the draft was kept")

    msg.status = "sent"
    msg.sent_at = func.now()
    msg.approved_by = principal.user.id  # the person who actually approved it
    advance(lead, "approve")

    await log_activity(
        db=db,
        lead_id=lead_id,
        actor=principal.actor,
        action="outreach_sent",
        detail={"message_id": str(msg.id), "transport": transport},
    )
    await db.commit()
    return {"status": "sent", "message_id": str(msg.id), "transport": transport}


@router.post("/{lead_id}/outreach/reject")
async def reject_outreach(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(approver),
):
    lead = await _lead_for_decision(db, lead_id, principal, "reject")
    msg = await _latest_draft(db, lead_id)

    msg.status = "rejected"
    # Back to "scored" so it can be re-drafted or left alone
    advance(lead, "reject")

    await log_activity(
        db=db,
        lead_id=lead_id,
        actor=principal.actor,
        action="outreach_rejected",
        detail={"message_id": str(msg.id)},
    )
    await db.commit()
    return {"status": "rejected", "message_id": str(msg.id)}


@drafts_router.get("/drafts")
async def list_drafts(db: AsyncSession = Depends(get_db), principal: Principal = Depends(any_user)):
    """Every pending draft in the caller's organisation, for the Approvals queue."""
    latest_score = latest_score_subquery()
    rows = (
        await db.execute(
            select(Lead, Company, OutreachMessage, latest_score.c.tier, latest_score.c.total_score)
            .join(Company, Lead.company_id == Company.id)
            .join(OutreachMessage, OutreachMessage.lead_id == Lead.id)
            .outerjoin(latest_score, latest_score.c.lead_id == Lead.id)
            .where(
                Lead.org_id == principal.org_id,
                Lead.stage == "outreach_drafted",
                Lead.do_not_contact.is_(False),
                OutreachMessage.status == "draft",
            )
            .order_by(latest_score.c.total_score.desc().nulls_last(), OutreachMessage.created_at)
        )
    ).all()
    return [
        {
            "lead_id": str(lead.id),
            "message_id": str(msg.id),
            "full_name": lead.full_name,
            "title": lead.title,
            "email": lead.email,
            "company_name": company.name,
            "tier": tier,
            "total_score": total_score,
            "subject": msg.subject,
            "body": msg.body,
            "created_at": msg.created_at,
        }
        for lead, company, msg, tier, total_score in rows
    ]

