import logging
from apps.api.config import settings

logger = logging.getLogger("leadforge.email_client")

async def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Mock email transmission client.
    Simulates sending emails, printing content to stdout, and logging results.
    """
    logger.info(f"Email Dispatch Request => To: {to_email} | Subject: {subject}")
    
    # Render visible diagnostic message in standard output
    print(f"\n=================== [EMAIL OUTBOX SHIM] ===================")
    print(f"TO:      {to_email}")
    print(f"SUBJECT: {subject}")
    print(f"BODY:\n{body}")
    print(f"===========================================================\n")
    
    return True
