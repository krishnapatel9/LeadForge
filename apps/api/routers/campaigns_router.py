"""Campaign profiles (the ICP a set of leads is sourced against), with live counts."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import case, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.auth.dependencies import Principal, any_user, require_roles
from apps.api.db.session import get_db
from apps.api.models.orm.campaign import Campaign
from apps.api.models.orm.lead import Lead
from apps.api.models.orm.outreach_message import OutreachMessage
from apps.api.services.score_queries import latest_score_subquery

router = APIRouter(prefix="/campaigns", tags=["campaigns"])
campaign_editor = require_roles("admin", "ops")

REPLIED_STAGES = ("replied", "booked", "won")


class CampaignIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    industry: str | None = Field(default=None, max_length=100)
    company_size: str | None = Field(default=None, max_length=100)

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be empty")
        return v


class CampaignPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    industry: str | None = Field(default=None, max_length=100)
    company_size: str | None = Field(default=None, max_length=100)
    active: bool | None = None


class CampaignOut(BaseModel):
    id: uuid.UUID
    name: str
    industry: str | None
    company_size: str | None
    active: bool
    leads_sourced: int
    avg_score: int | None
    emails_sent: int
    replies: int
    conversion_rate: float | None  # replies / leads emailed


def _out(c: Campaign, sourced=0, avg=None, sent=0, replies=0) -> CampaignOut:
    icp = c.icp_filter or {}
    return CampaignOut(
        id=c.id,
        name=c.name,
        industry=icp.get("industry"),
        company_size=icp.get("company_size"),
        active=bool(c.active),
        leads_sourced=int(sourced or 0),
        avg_score=round(avg) if avg is not None else None,
        emails_sent=int(sent or 0),
        replies=int(replies or 0),
        conversion_rate=(replies / sent) if sent else None,
    )


async def _get_owned(db: AsyncSession, campaign_id: uuid.UUID, principal: Principal) -> Campaign:
    c = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalars().first()
    if not c or c.org_id != principal.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return c


@router.get("", response_model=list[CampaignOut])
async def list_campaigns(db: AsyncSession = Depends(get_db), principal: Principal = Depends(any_user)):
    latest_score = latest_score_subquery()
    # Leads that were actually emailed, counted from the messages (as on Performance).
    # The stage alone misses leads that were emailed and then unsubscribed.
    emailed = (
        select(OutreachMessage.lead_id)
        .where(OutreachMessage.status == "sent")
        .group_by(OutreachMessage.lead_id)
        .subquery()
    )
    stats = (
        select(
            Lead.campaign_id.label("campaign_id"),
            func.count(Lead.id).label("sourced"),
            func.avg(latest_score.c.total_score).label("avg_score"),
            func.count(emailed.c.lead_id).label("sent"),
            func.count(case((Lead.stage.in_(REPLIED_STAGES), 1))).label("replies"),
        )
        .outerjoin(latest_score, latest_score.c.lead_id == Lead.id)
        .outerjoin(emailed, emailed.c.lead_id == Lead.id)
        .where(Lead.campaign_id.is_not(None))
        .group_by(Lead.campaign_id)
        .subquery()
    )
    rows = (
        await db.execute(
            select(Campaign, stats.c.sourced, stats.c.avg_score, stats.c.sent, stats.c.replies)
            .outerjoin(stats, stats.c.campaign_id == Campaign.id)
            .where(Campaign.org_id == principal.org_id)
            .order_by(Campaign.created_at.desc())
        )
    ).all()
    return [_out(c, sourced, float(avg) if avg is not None else None, sent, replies)
            for c, sourced, avg, sent, replies in rows]


@router.post("", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignIn,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(campaign_editor),
):
    icp = {k: v for k, v in {"industry": payload.industry, "company_size": payload.company_size}.items() if v}
    c = Campaign(org_id=principal.org_id, name=payload.name, icp_filter=icp, active=True)
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _out(c)


@router.patch("/{campaign_id}", response_model=CampaignOut)
async def update_campaign(
    campaign_id: uuid.UUID,
    payload: CampaignPatch,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(campaign_editor),
):
    c = await _get_owned(db, campaign_id, principal)
    if payload.name is not None:
        c.name = payload.name.strip()
    if payload.active is not None:
        c.active = payload.active
    icp = dict(c.icp_filter or {})
    for key in ("industry", "company_size"):
        value = getattr(payload, key)
        if value is not None:
            if value:
                icp[key] = value
            else:
                icp.pop(key, None)
    c.icp_filter = icp
    await db.commit()
    await db.refresh(c)
    return _out(c)
