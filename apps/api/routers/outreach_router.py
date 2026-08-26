import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.db.session import get_db
from apps.api.models.orm.lead import Lead
from apps.api.models.orm.company import Company
from apps.api.models.orm.research_brief import ResearchBrief
from apps.api.models.orm.outreach_message import OutreachMessage
from apps.api.models.orm.user import User
from apps.api.models.orm.organization import Organization
from apps.api.models.schemas import OutreachDraft
from apps.api.services.outreach_service import draft_outreach_db
from apps.api.services.activity_service import log_activity

router = APIRouter(prefix="/leads", tags=["outreach"])


async def get_or_create_ae_user(db: AsyncSession, org_id: uuid.UUID) -> User:
    user_stmt = select(User).limit(1)
    user_res = await db.execute(user_stmt)
    user = user_res.scalars().first()
    if not user:
        user = User(
            org_id=org_id,
            email="ae@agency.com",
            name="Default Account Executive",
            role="ae",
        )
        db.add(user)
        await db.flush()
    return user


@router.post("/{lead_id}/draft-outreach", response_model=OutreachDraft)
async def draft_outreach_endpoint(lead_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    # 1. Fetch Lead
    lead_stmt = select(Lead).where(Lead.id == lead_id)
    lead_res = await db.execute(lead_stmt)
    lead = lead_res.scalars().first()
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with id {lead_id} not found",
        )

    # 2. Fetch Company
    company_stmt = select(Company).where(Company.id == lead.company_id)
    company_res = await db.execute(company_stmt)
    company = company_res.scalars().first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with id {lead.company_id} not found for lead {lead_id}",
        )

    # 3. Fetch latest Research Brief
    brief_stmt = (
        select(ResearchBrief)
        .where(ResearchBrief.lead_id == lead_id)
        .order_by(ResearchBrief.created_at.desc())
        .limit(1)
    )
    brief_res = await db.execute(brief_stmt)
    brief = brief_res.scalars().first()
    if not brief:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Research brief must be generated before drafting outreach for lead {lead_id}.",
        )

    # 4. Generate outreach draft
    try:
        draft = await draft_outreach_db(
            db=db,
            lead=lead,
            company=company,
            research=brief,
        )
        await db.commit()
        return draft
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate outreach draft: {exc}",
        )


from apps.api.clients.email_client import send_email

from pydantic import BaseModel

class OutreachApprovalPayload(BaseModel):
    subject: str | None = None
    body: str | None = None

@router.post("/{lead_id}/outreach/approve")
async def approve_outreach(
    lead_id: uuid.UUID,
    payload: OutreachApprovalPayload = None,
    db: AsyncSession = Depends(get_db)
):
    lead_stmt = select(Lead).where(Lead.id == lead_id)
    lead_res = await db.execute(lead_stmt)
    lead = lead_res.scalars().first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    if lead.do_not_contact:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot dispatch outreach. Lead has opted out of communication (Do Not Contact)."
        )

    msg_stmt = (
        select(OutreachMessage)
        .where(OutreachMessage.lead_id == lead_id, OutreachMessage.status == "draft")
        .order_by(OutreachMessage.created_at.desc())
        .limit(1)
    )
    msg_res = await db.execute(msg_stmt)
    msg = msg_res.scalars().first()
    if not msg:
        raise HTTPException(status_code=404, detail="No draft outreach message found for this lead.")

    # Override subject/body if edited by user
    if payload:
        if payload.subject is not None:
            msg.subject = payload.subject
        if payload.body is not None:
            msg.body = payload.body

    # Dispatch email via transport client shim
    await send_email(to_email=lead.email, subject=msg.subject, body=msg.body)

    ae_user = await get_or_create_ae_user(db, lead.org_id)
    msg.status = "approved"
    msg.approved_by = ae_user.id
    db.add(msg)
    
    # Transition the lead stage to 'outreach_sent' (approved & dispatched stage)
    lead.stage = "outreach_sent"
    db.add(lead)

    
    await log_activity(
        db=db,
        lead_id=lead_id,
        actor=ae_user.email,
        action="outreach_approved",
        detail={"message_id": str(msg.id)},
    )
    await db.commit()
    return {"status": "approved", "message_id": str(msg.id)}




@router.post("/{lead_id}/outreach/reject")
async def reject_outreach(lead_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    lead_stmt = select(Lead).where(Lead.id == lead_id)
    lead_res = await db.execute(lead_stmt)
    lead = lead_res.scalars().first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    msg_stmt = (
        select(OutreachMessage)
        .where(OutreachMessage.lead_id == lead_id, OutreachMessage.status == "draft")
        .order_by(OutreachMessage.created_at.desc())
        .limit(1)
    )
    msg_res = await db.execute(msg_stmt)
    msg = msg_res.scalars().first()
    if not msg:
        raise HTTPException(status_code=404, detail="No draft outreach message found for this lead.")

    ae_user = await get_or_create_ae_user(db, lead.org_id)
    msg.status = "rejected"
    db.add(msg)
    
    # When rejected, we transition stage back to 'scored' so it can be regenerated or ignored
    lead.stage = "scored"
    db.add(lead)

    await log_activity(
        db=db,
        lead_id=lead_id,
        actor=ae_user.email,
        action="outreach_rejected",
        detail={"message_id": str(msg.id)},
    )
    await db.commit()
    return {"status": "rejected", "message_id": str(msg.id)}
