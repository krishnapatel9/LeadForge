import logging
from html import escape

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.auth.security import service_key_matches, verify_unsubscribe_token
from apps.api.db.session import get_db
from apps.api.models.orm.lead import Lead
from apps.api.services.activity_service import log_activity
from apps.api.services.normalize import normalize_email

logger = logging.getLogger("leadforge.webhooks_router")

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class UnsubscribePayload(BaseModel):
    email: str
    # Signed token from the email's unsubscribe link. Not needed when an email
    # provider calls this webhook with the service X-API-Key instead.
    token: str | None = None


async def _unsubscribe(db: AsyncSession, email: str, source: str) -> dict:
    email_clean = normalize_email(email)

    # Compare case-insensitively so rows stored before ingest normalisation still match.
    stmt = select(Lead).where(func.lower(Lead.email) == email_clean)
    result = await db.execute(stmt)
    leads = result.scalars().all()

    if not leads:
        logger.warning("Unsubscribe requested for unknown address")
        return {"status": "unsubscribed", "matches": 0, "updated": 0}

    updated_count = 0
    for lead in leads:
        if not lead.do_not_contact:
            lead.do_not_contact = True
            lead.stage = "unsubscribed"
            db.add(lead)
            await log_activity(
                db=db,
                lead_id=lead.id,
                actor="System Webhook",
                action="opt_out",
                detail={"source": source},
            )
            updated_count += 1

    await db.commit()
    logger.info("Unsubscribed lead(s): matches=%s updated=%s", len(leads), updated_count)
    return {"status": "unsubscribed", "matches": len(leads), "updated": updated_count}


def _authorise(email: str, token: str | None, api_key: str | None) -> str:
    """Returns the source label, or raises 403. Stops anyone unsubscribing arbitrary addresses."""
    if service_key_matches(api_key):
        return "email_provider_webhook"
    if token and verify_unsubscribe_token(email, token):
        return "unsubscribe_email_link"
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or missing unsubscribe token")


@router.post("/unsubscribe")
async def unsubscribe_webhook(
    payload: UnsubscribePayload,
    db: AsyncSession = Depends(get_db),
    x_api_key: str | None = Header(default=None),
):
    """One-click unsubscribe (RFC 8058 POST) or provider webhook."""
    source = _authorise(payload.email, payload.token, x_api_key)
    return await _unsubscribe(db, payload.email, source)


@router.get("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe_link(email: str, token: str, db: AsyncSession = Depends(get_db)):
    """The link a recipient clicks in an email. Shows a plain confirmation page."""
    source = _authorise(email, token, None)
    await _unsubscribe(db, email, source)
    return HTMLResponse(
        "<!doctype html><meta charset='utf-8'><title>Unsubscribed</title>"
        "<body style='font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem'>"
        f"<h1>You're unsubscribed</h1><p>{escape(normalize_email(email))} won't receive "
        "any more emails from us.</p></body>"
    )
