import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.auth.dependencies import Principal, get_principal
from apps.api.auth.security import burn_password_check, create_access_token, verify_password
from apps.api.db.session import get_db
from apps.api.models.orm.user import User
from apps.api.services.normalize import normalize_email

router = APIRouter(prefix="/auth", tags=["auth"])

# Simple in-process throttle: 5 failed logins per email+IP per 15 minutes.
# Enough for a single-instance internal tool; use Redis if the API is scaled out.
_MAX_FAILURES = 5
_WINDOW_SECONDS = 15 * 60
_failures: dict[str, deque] = defaultdict(deque)


def _throttle_key(request: Request, email: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}|{email}"


def _recent_failures(key: str) -> deque:
    attempts = _failures[key]
    cutoff = time.monotonic() - _WINDOW_SECONDS
    while attempts and attempts[0] < cutoff:
        attempts.popleft()
    return attempts


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str | None
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


def _user_out(user: User) -> UserOut:
    return UserOut(id=str(user.id), email=user.email, name=user.name, role=user.role)


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    email = normalize_email(payload.email)
    key = _throttle_key(request, email)
    if len(_recent_failures(key)) >= _MAX_FAILURES:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed sign-in attempts. Try again in 15 minutes.",
        )

    result = await db.execute(select(User).where(func.lower(User.email) == email))
    user = result.scalars().first()

    if user is None:
        burn_password_check(payload.password)  # same timing as a wrong password
        ok = False
    else:
        ok = verify_password(payload.password, user.password_hash) and user.is_active

    if not ok:
        _recent_failures(key).append(time.monotonic())
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    _failures.pop(key, None)
    user.last_login_at = func.now()
    await db.commit()

    token, expires_in = create_access_token(user.id, user.role, user.org_id)
    return LoginResponse(access_token=token, expires_in=expires_in, user=_user_out(user))


@router.get("/me", response_model=UserOut)
async def me(principal: Principal = Depends(get_principal)):
    if principal.user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Service keys have no user profile")
    return _user_out(principal.user)
