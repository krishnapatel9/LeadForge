import smtplib
from email.message import EmailMessage
from apps.api.config import settings

def send_outreach_email(to_email: str, subject: str, body: str) -> bool:
    """
    Sends an email using standard SMTP.
    If credentials are empty, mocks the send (useful for local development).
    """
    # If no username/password provided, just mock it.
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        print(f"[MOCK EMAIL] To: {to_email} | Subject: {subject}")
        print(f"Body: \n{body}\n")
        return True
        
    msg = EmailMessage()
    msg.set_content(body)
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_USERNAME
    msg["To"] = to_email

    try:
        # Use SMTP_SSL for 465, or SMTP with starttls for 587
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_SERVER, settings.SMTP_PORT)
        else:
            server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
            server.starttls()
            
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Error sending email to {to_email}: {e}")
        return False
