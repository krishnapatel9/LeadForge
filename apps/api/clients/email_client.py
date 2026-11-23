"""The one place outreach email leaves the system.

With SMTP_USERNAME and SMTP_PASSWORD set it sends over SMTP (implicit TLS on port
465, STARTTLS otherwise). Without them it logs the message as a mock send, so
local development works with no mail account. Every message carries RFC 8058
one-click unsubscribe headers pointing at the signed /webhooks/unsubscribe link.
"""

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from email.utils import make_msgid

from apps.api.config import settings

logger = logging.getLogger("leadforge.email_client")


class EmailSendError(RuntimeError):
    pass


def smtp_configured() -> bool:
    return bool(settings.SMTP_USERNAME and settings.SMTP_PASSWORD)


def build_message(to_email: str, subject: str, body: str, unsubscribe_url: str) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USERNAME or "leadforge@localhost"
    msg["To"] = to_email
    msg["Message-ID"] = make_msgid(domain="leadforge")
    msg["List-Unsubscribe"] = f"<{unsubscribe_url}>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg.set_content(body)
    return msg


def _send_smtp(msg: EmailMessage) -> None:
    timeout = 30
    if settings.SMTP_PORT == 465:
        server = smtplib.SMTP_SSL(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=timeout)
    else:
        server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=timeout)
        server.starttls()
    try:
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except smtplib.SMTPException:
            pass


async def send_email(to_email: str, subject: str, body: str, unsubscribe_url: str) -> str:
    """Sends the email. Returns "smtp" or "mock". Raises EmailSendError on failure."""
    msg = build_message(to_email, subject, body, unsubscribe_url)

    if not smtp_configured():
        logger.info("[MOCK EMAIL] To: %s | Subject: %s\n%s\n%s", to_email, subject,
                    "\n".join(f"{k}: {v}" for k, v in msg.items()), body)
        return "mock"

    try:
        # smtplib blocks; run it off the event loop
        await asyncio.to_thread(_send_smtp, msg)
    except (smtplib.SMTPException, OSError) as exc:
        logger.error("SMTP send to %s failed: %s", to_email, exc)
        raise EmailSendError(str(exc)) from exc

    logger.info("Sent outreach email to %s", to_email)
    return "smtp"
