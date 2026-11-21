"""FastAPI dependencies that identify the caller and enforce roles.

Two kinds of caller:
- a signed-in person (dashboard): `Authorization: Bearer <jwt>`, role admin / ae / ops
- automation such as n8n: `X-API-Key: <SERVICE_API_KEY>`, allowed only where a
  route opts in with allow_service=True (never for approving outreach)
"""

import uuid
from dataclasses import dataclass

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.auth.security import decode_access_token, service_key_matches
from apps.api.db.session import get_db
from apps.api.models.orm.user import User

ROLES = ("admin", "ae", "ops")

_bearer = HTTPBearer(auto_error=False)


@dataclass
class Principal:
    kind: str  # "user" | "service"
    role: str  # admin | ae | ops | service
    user: User | None = None

    @property
    def is_service(self) -> bool:
        return self.kind == "service"

    @property
    def org_id(self) -> uuid.UUID | None:
        return self.user.org_id if self.user else None

    @property
    def actor(self) -> str:
        """Name recorded in activity_log."""
        return self.user.email if self.user else "service:automation"


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    x_api_key: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Principal:
    if credentials is not None:
        try:
            payload = decode_access_token(credentials.credentials)
            user_id = uuid.UUID(payload["sub"])
        except (jwt.InvalidTokenError, ValueError, KeyError):
            raise _unauthorized("Invalid or expired token")

        # Re-read the user so a deactivated account or changed role takes effect at once
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        if not user or not user.is_active:
            raise _unauthorized("Account not found or disabled")
        return Principal(kind="user", role=user.role, user=user)

    if x_api_key is not None:
        if service_key_matches(x_api_key):
            return Principal(kind="service", role="service")
        raise _unauthorized("Invalid API key")

    raise _unauthorized()


def require_roles(*roles: str, allow_service: bool = False):
    """Dependency factory: the caller must have one of `roles` (or be the service, if allowed)."""

    async def checker(principal: Principal = Depends(get_principal)) -> Principal:
        if principal.is_service:
            if allow_service:
                return principal
        elif principal.role in roles:
            return principal
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed for your role")

    return checker


# Common combinations
any_user = require_roles(*ROLES)
pipeline_caller = require_roles("admin", "ops", "ae", allow_service=True)
ingest_caller = require_roles("admin", "ops", allow_service=True)
approver = require_roles("admin", "ae")
admin_or_service = require_roles("admin", allow_service=True)


def ensure_same_org(principal: Principal, org_id: uuid.UUID) -> None:
    """Users may only touch their own organisation's leads. Hide others as 404."""
    if principal.user is not None and principal.user.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
