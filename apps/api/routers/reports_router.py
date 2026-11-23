"""Performance numbers, computed from the database.

Everything is a cohort of the leads sourced in the period (created_at within the
last `days` days), so the KPIs and the funnel describe the same set of leads.
Deltas compare against the cohort of the period before.
"""

import csv
import io
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import case, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.auth.dependencies import Principal, any_user
from apps.api.db.session import get_db
from apps.api.models.orm.company import Company
from apps.api.models.orm.lead import Lead
from apps.api.services.score_queries import latest_score_subquery
from apps.api.models.orm.outreach_message import OutreachMessage

router = APIRouter(prefix="/reports", tags=["reports"])

REPLIED = ("replied", "booked", "won")
BOOKED = ("booked", "won")


def _latest_score():
    return latest_score_subquery()


async def _cohort(db: AsyncSession, org_id: uuid.UUID, start: datetime, end: datetime) -> dict:
    score = _latest_score()
    in_cohort = (Lead.org_id == org_id) & (Lead.created_at >= start) & (Lead.created_at < end)

    row = (
        await db.execute(
            select(
                func.count(Lead.id),
                func.count(score.c.lead_id),
                func.avg(score.c.total_score),
                func.count(case((Lead.stage.in_(REPLIED), 1))),
                func.count(case((Lead.stage.in_(BOOKED), 1))),
            )
            .outerjoin(score, score.c.lead_id == Lead.id)
            .where(in_cohort)
        )
    ).one()
    sourced, scored, avg_score, replies, booked = row

    msg_row = (
        await db.execute(
            select(
                func.count(func.distinct(case((OutreachMessage.status == "sent", OutreachMessage.lead_id)))),
                func.count(case((OutreachMessage.status == "sent", 1))),
                func.count(case((OutreachMessage.status == "rejected", 1))),
            )
            .join(Lead, Lead.id == OutreachMessage.lead_id)
            .where(in_cohort)
        )
    ).one()
    approved_leads, sent, rejected = msg_row

    decided = sent + rejected
    return {
        "sourced": int(sourced),
        "scored": int(scored),
        "avg_score": round(float(avg_score)) if avg_score is not None else None,
        "approval_rate": (sent / decided) if decided else None,
        "sent": int(sent),
        "approved_leads": int(approved_leads),
        "replies": int(replies),
        "booked": int(booked),
    }


def _pct_delta(now, before):
    if now is None or before in (None, 0):
        return None
    return (now - before) / before


def _diff(now, before):
    if now is None or before is None:
        return None
    return now - before


@router.get("/summary")
async def summary(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(any_user),
):
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    cur = await _cohort(db, principal.org_id, start, end)
    prev = await _cohort(db, principal.org_id, start - timedelta(days=days), start)

    kpis = [
        {"key": "sourced", "label": "Leads sourced", "value": cur["sourced"], "format": "int",
         "delta": _pct_delta(cur["sourced"], prev["sourced"]), "delta_format": "pct"},
        {"key": "avg_score", "label": "Average score", "value": cur["avg_score"], "format": "score",
         "delta": _diff(cur["avg_score"], prev["avg_score"]), "delta_format": "pts"},
        {"key": "approval_rate", "label": "Approved by you", "value": cur["approval_rate"], "format": "pct",
         "delta": _diff(cur["approval_rate"], prev["approval_rate"]), "delta_format": "pct_pts"},
        {"key": "sent", "label": "Emails sent", "value": cur["sent"], "format": "int",
         "delta": _pct_delta(cur["sent"], prev["sent"]), "delta_format": "pct"},
        {"key": "replies", "label": "Replies", "value": cur["replies"], "format": "int",
         "delta": _pct_delta(cur["replies"], prev["replies"]), "delta_format": "pct"},
        {"key": "booked", "label": "Meetings booked", "value": cur["booked"], "format": "int",
         "delta": _pct_delta(cur["booked"], prev["booked"]), "delta_format": "pct"},
    ]
    funnel = [
        {"stage": "Leads ingested", "count": cur["sourced"]},
        {"stage": "Researched and scored", "count": cur["scored"]},
        {"stage": "Outreach approved", "count": cur["approved_leads"]},
        {"stage": "Prospect replied", "count": cur["replies"]},
        {"stage": "Meeting booked", "count": cur["booked"]},
    ]
    return {
        "days": days,
        "start": start,
        "end": end,
        "kpis": kpis,
        "funnel": funnel,
        "meeting_rate": (cur["booked"] / cur["sourced"]) if cur["sourced"] else None,
    }


@router.get("/export.csv")
async def export_csv(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(any_user),
):
    start = datetime.now(timezone.utc) - timedelta(days=days)
    score = _latest_score()
    sent = (
        select(OutreachMessage.lead_id, func.max(OutreachMessage.sent_at).label("sent_at"))
        .where(OutreachMessage.status == "sent")
        .group_by(OutreachMessage.lead_id)
        .subquery()
    )
    rows = (
        await db.execute(
            select(Lead, Company, score.c.tier, score.c.total_score, sent.c.sent_at)
            .join(Company, Company.id == Lead.company_id)
            .outerjoin(score, score.c.lead_id == Lead.id)
            .outerjoin(sent, sent.c.lead_id == Lead.id)
            .where(Lead.org_id == principal.org_id, Lead.created_at >= start)
            .order_by(Lead.created_at.desc())
        )
    ).all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["full_name", "title", "email", "company", "domain", "stage", "tier",
                "total_score", "do_not_contact", "added", "sent_at"])
    for lead, company, tier, total, sent_at in rows:
        w.writerow([lead.full_name, lead.title or "", lead.email, company.name, company.domain,
                    lead.stage, tier or "", "" if total is None else total, lead.do_not_contact,
                    lead.created_at.isoformat(), sent_at.isoformat() if sent_at else ""])

    filename = f"leadforge_pipeline_{datetime.now(timezone.utc):%Y%m%d}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
