"""Creates the first admin on start-up when BOOTSTRAP_ADMIN_EMAIL/PASSWORD are set.

Only creates a missing account; an existing user (password, role, active flag)
is never changed here. Use scripts/create_user.py to reset a password.
"""

import logging

from sqlalchemy import func
from sqlalchemy.future import select

from apps.api.auth.security import MIN_PASSWORD_LENGTH, hash_password
from apps.api.config import settings
from apps.api.db.session import SessionLocal
from apps.api.models.orm.organization import Organization
from apps.api.models.orm.user import User
from apps.api.services.normalize import normalize_email

log = logging.getLogger("leadforge.bootstrap")


async def ensure_bootstrap_admin() -> str:
    """Returns what happened: "disabled", "invalid", "exists" or "created"."""
    email = normalize_email(settings.BOOTSTRAP_ADMIN_EMAIL or "")
    password = settings.BOOTSTRAP_ADMIN_PASSWORD or ""
    if not email and not password:
        return "disabled"
    if "@" not in email or len(password) < MIN_PASSWORD_LENGTH:
        log.warning(
            "BOOTSTRAP_ADMIN_EMAIL/PASSWORD ignored: need a valid email and a password of at least %s characters",
            MIN_PASSWORD_LENGTH,
        )
        return "invalid"

    async with SessionLocal() as db:
        existing = (await db.execute(select(User).where(func.lower(User.email) == email))).scalars().first()
        if existing:
            return "exists"
        org = (await db.execute(select(Organization).limit(1))).scalars().first()
        if org is None:
            org = Organization(name="Default Agency")
            db.add(org)
            await db.flush()
        db.add(User(org_id=org.id, email=email, name="Admin", role="admin",
                    password_hash=hash_password(password), is_active=True))
        await db.commit()
    log.info("Created bootstrap admin %s", email)
    return "created"
