import logging
from html import escape
from urllib.parse import parse_qs

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, ValidationError
from sqlalchemy import func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.auth.security import service_key_matches, verify_unsubscribe_token
from apps.api.db.session import get_db
from apps.api.models.orm.lead import Lead
from apps.api.models.orm.outreach_message import OutreachMessage
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
            # Pending drafts must never be sent after an opt-out
            await db.execute(
                update(OutreachMessage)
                .where(OutreachMessage.lead_id == lead.id, OutreachMessage.status == "draft")
                .values(status="rejected")
            )
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
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_api_key: str | None = Header(default=None),
):
    """Accepts three callers:
    - RFC 8058 one-click: mail clients POST `List-Unsubscribe=One-Click` (form-encoded)
      to the link from the List-Unsubscribe header, so email and token are in the query.
    - a JSON body `{"email", "token"}`.
    - an email provider webhook: JSON `{"email"}` with the service X-API-Key.
    """
    email = request.query_params.get("email")
    token = request.query_params.get("token")

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            payload = UnsubscribePayload.model_validate(await request.json())
        except (ValueError, ValidationError):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Body must be {email, token?}")
        email, token = payload.email, payload.token or token
    elif "application/x-www-form-urlencoded" in content_type:
        # RFC 8058 bodies are just "List-Unsubscribe=One-Click"; email and token
        # normally come from the query string, but accept them in the body too.
        form = parse_qs((await request.body()).decode("utf-8", "replace"))
        email = (form.get("email") or [email])[0]
        token = (form.get("token") or [token])[0]
    # Any other body (e.g. multipart one-click) carries nothing we need: use the query.

    if not email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="email is required")
    source = _authorise(str(email), token, x_api_key)
    return await _unsubscribe(db, str(email), source)


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
