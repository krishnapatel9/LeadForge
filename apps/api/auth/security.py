"""Password hashing, login tokens and signed unsubscribe tokens.

Passwords use scrypt from the standard library (memory-hard, no extra dependency).
Login tokens are short-lived HS256 JWTs. Unsubscribe tokens are an HMAC of the
email address, so a link can only unsubscribe the address it was issued for.
"""

import base64
import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from apps.api.config import settings
from apps.api.services.normalize import normalize_email

# scrypt cost parameters (N=2^14, r=8, p=1: ~16 MB, the OWASP minimum)
_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 64
_ALGORITHM = "HS256"

MIN_PASSWORD_LENGTH = 12


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _scrypt(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=n, r=r, p=p,
        dklen=_SCRYPT_DKLEN, maxmem=128 * 1024 * 1024,
    )


def hash_password(password: str) -> str:
    """Returns 'scrypt$N$r$p$salt$hash'. The parameters are stored so they can be raised later."""
    salt = os.urandom(16)
    digest = _scrypt(password, salt, _SCRYPT_N, _SCRYPT_R, _SCRYPT_P)
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str | None) -> bool:
    """Constant-time check. Returns False for missing or malformed hashes."""
    if not stored:
        return False
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        candidate = _scrypt(password, _unb64(salt), int(n), int(r), int(p))
        return hmac.compare_digest(candidate, _unb64(digest))
    except (ValueError, TypeError):
        return False


# A real hash to verify against when the email is unknown, so a login for a
# missing user takes as long as one for an existing user (no user enumeration).
_DUMMY_HASH = hash_password(os.urandom(16).hex())


def burn_password_check(password: str) -> None:
    verify_password(password, _DUMMY_HASH)


def create_access_token(user_id: uuid.UUID, role: str, org_id: uuid.UUID) -> tuple[str, int]:
    """Returns (token, expires_in_seconds)."""
    expires_in = settings.JWT_EXPIRE_MINUTES * 60
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "org": str(org_id),
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
        "typ": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=_ALGORITHM), expires_in


def decode_access_token(token: str) -> dict:
    """Raises jwt.InvalidTokenError on a bad, expired or wrong-type token."""
    payload = jwt.decode(
        token, settings.JWT_SECRET, algorithms=[_ALGORITHM],
        options={"require": ["sub", "exp", "iat"]},
    )
    if payload.get("typ") != "access":
        raise jwt.InvalidTokenError("not an access token")
    return payload


def unsubscribe_token(email: str) -> str:
    key = hashlib.sha256(b"unsubscribe:" + settings.JWT_SECRET.encode()).digest()
    mac = hmac.new(key, normalize_email(email).encode("utf-8"), hashlib.sha256).digest()
    return _b64(mac)


def verify_unsubscribe_token(email: str, token: str) -> bool:
    return hmac.compare_digest(unsubscribe_token(email), token or "")


def service_key_matches(provided: str | None) -> bool:
    """True only when a service key is configured and the provided one matches."""
    if not settings.SERVICE_API_KEY or not provided:
        return False
    return hmac.compare_digest(settings.SERVICE_API_KEY, provided)
