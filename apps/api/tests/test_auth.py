"""Auth tests that run without a database.

The DB session is replaced with a fake that returns one configurable user, so
these exercise the real routes, dependencies, tokens and role rules.
"""

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import httpx
import jwt
import pytest

from apps.api.auth import security
from apps.api.auth.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    unsubscribe_token,
    verify_password,
    verify_unsubscribe_token,
)
from apps.api.config import settings
from apps.api.db.session import get_db
from apps.api.main import app
from apps.api.routers import auth_router
from apps.api.services.outreach_service import with_compliance_footer

ORG_ID = uuid.uuid4()
PASSWORD = "correct horse battery staple"
PASSWORD_HASH = hash_password(PASSWORD)


# --- Passwords and tokens --------------------------------------------------

def test_password_hash_round_trip():
    stored = hash_password("s3cret-passphrase")
    assert stored.startswith("scrypt$")
    assert verify_password("s3cret-passphrase", stored)
    assert not verify_password("wrong", stored)


def test_same_password_gets_different_salts():
    assert hash_password("same") != hash_password("same")


@pytest.mark.parametrize("stored", [None, "", "plaintext", "bcrypt$x$y", "scrypt$bad"])
def test_malformed_hashes_never_verify(stored):
    assert not verify_password("anything", stored)


def test_access_token_round_trip():
    user_id = uuid.uuid4()
    token, expires_in = create_access_token(user_id, "ae", ORG_ID)
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["role"] == "ae"
    assert expires_in == settings.JWT_EXPIRE_MINUTES * 60


def test_tampered_token_is_rejected():
    token, _ = create_access_token(uuid.uuid4(), "ops", ORG_ID)
    forged = jwt.encode(
        {**jwt.decode(token, options={"verify_signature": False}), "role": "admin"},
        "attacker-secret-that-is-long-enough-for-hs256", algorithm="HS256",
    )
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(forged)


def test_expired_token_is_rejected():
    past = datetime.now(timezone.utc) - timedelta(hours=2)
    token = jwt.encode(
        {"sub": str(uuid.uuid4()), "iat": past, "exp": past + timedelta(minutes=1), "typ": "access"},
        settings.JWT_SECRET, algorithm="HS256",
    )
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(token)


def test_unsubscribe_token_is_bound_to_one_address():
    token = unsubscribe_token("Jane@Acme.com")
    assert verify_unsubscribe_token("jane@acme.com", token)  # case-insensitive
    assert not verify_unsubscribe_token("someone.else@acme.com", token)
    assert not verify_unsubscribe_token("jane@acme.com", "")


def test_every_email_gets_an_unsubscribe_link_and_address():
    body = with_compliance_footer("Hi Jane,\n\nQuick question.", "jane@acme.com")
    assert settings.AGENCY_POSTAL_ADDRESS in body
    assert "/webhooks/unsubscribe?email=jane%40acme.com&token=" in body


# --- Routes -----------------------------------------------------------------

class _Result:
    def __init__(self, value):
        self._value = value

    def scalars(self):
        return self

    def first(self):
        return self._value

    def all(self):
        return [] if self._value is None else [self._value]


class FakeDB:
    """Returns `user` for every query (or None), and records commits."""

    def __init__(self, user=None):
        self.user = user
        self.commits = 0

    async def execute(self, _stmt):
        return _Result(self.user)

    def add(self, _obj):
        pass

    async def commit(self):
        self.commits += 1

    async def flush(self):
        pass


def _user(role="ae", active=True):
    return SimpleNamespace(
        id=uuid.uuid4(), org_id=ORG_ID, email="jane@agency.com", name="Jane",
        role=role, password_hash=PASSWORD_HASH, is_active=active, last_login_at=None,
    )


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def client_with(monkeypatch):
    """Yields a factory: client_with(user) -> AsyncClient whose DB returns `user`."""
    clients = []
    auth_router._failures.clear()

    def make(user=None):
        db = FakeDB(user)

        async def override():
            yield db

        app.dependency_overrides[get_db] = override
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        clients.append(client)
        return client

    yield make
    app.dependency_overrides.clear()


def _bearer(user) -> dict:
    token, _ = create_access_token(user.id, user.role, user.org_id)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.anyio
async def test_health_is_public(client_with):
    async with client_with() as client:
        assert (await client.get("/health")).status_code == 200


@pytest.mark.anyio
@pytest.mark.parametrize("method,path", [
    ("get", "/leads"),
    ("get", f"/leads/{uuid.uuid4()}"),
    ("get", "/system-health"),
    ("post", "/leads/ingest"),
    ("post", f"/leads/{uuid.uuid4()}/research"),
    ("post", f"/leads/{uuid.uuid4()}/score"),
    ("post", f"/leads/{uuid.uuid4()}/draft-outreach"),
    ("post", f"/leads/{uuid.uuid4()}/outreach/approve"),
    ("post", f"/leads/{uuid.uuid4()}/outreach/reject"),
    ("post", "/poc/process-lead"),
    ("get", "/outreach/drafts"),
    ("get", "/campaigns"),
    ("post", "/campaigns"),
    ("patch", f"/campaigns/{uuid.uuid4()}"),
    ("get", "/reports/summary"),
    ("get", "/reports/export.csv"),
])
async def test_private_routes_require_auth(client_with, method, path):
    async with client_with() as client:
        res = await getattr(client, method)(path)
        assert res.status_code == 401, f"{method.upper()} {path} returned {res.status_code}"


@pytest.mark.anyio
async def test_garbage_token_is_rejected(client_with):
    async with client_with(_user()) as client:
        res = await client.get("/leads", headers={"Authorization": "Bearer not-a-jwt"})
        assert res.status_code == 401


@pytest.mark.anyio
async def test_disabled_account_token_stops_working(client_with):
    user = _user(active=False)
    async with client_with(user) as client:
        res = await client.get("/leads", headers=_bearer(user))
        assert res.status_code == 401


@pytest.mark.anyio
async def test_ops_cannot_approve_outreach(client_with):
    user = _user(role="ops")
    async with client_with(user) as client:
        res = await client.post(f"/leads/{uuid.uuid4()}/outreach/approve", headers=_bearer(user))
        assert res.status_code == 403


@pytest.mark.anyio
async def test_service_key_cannot_approve_outreach(client_with, monkeypatch):
    monkeypatch.setattr(settings, "SERVICE_API_KEY", "svc-key-123")
    async with client_with() as client:
        res = await client.post(f"/leads/{uuid.uuid4()}/outreach/approve", headers={"X-API-Key": "svc-key-123"})
        assert res.status_code == 403


@pytest.mark.anyio
async def test_wrong_service_key_is_rejected(client_with, monkeypatch):
    monkeypatch.setattr(settings, "SERVICE_API_KEY", "svc-key-123")
    async with client_with() as client:
        res = await client.post("/leads/ingest", json={}, headers={"X-API-Key": "guess"})
        assert res.status_code == 401


@pytest.mark.anyio
async def test_service_key_disabled_when_unset(client_with, monkeypatch):
    monkeypatch.setattr(settings, "SERVICE_API_KEY", "")
    async with client_with() as client:
        res = await client.post("/leads/ingest", json={}, headers={"X-API-Key": ""})
        assert res.status_code == 401


@pytest.mark.anyio
async def test_service_key_reaches_ingest(client_with, monkeypatch):
    monkeypatch.setattr(settings, "SERVICE_API_KEY", "svc-key-123")
    async with client_with() as client:
        # Past auth, the empty body fails validation (422), not auth (401/403)
        res = await client.post("/leads/ingest", json={}, headers={"X-API-Key": "svc-key-123"})
        assert res.status_code == 422


@pytest.mark.anyio
async def test_lead_from_another_org_is_hidden(client_with):
    user = _user(role="ae")
    other_org_lead = SimpleNamespace(id=uuid.uuid4(), org_id=uuid.uuid4(), do_not_contact=False)

    class Mixed(FakeDB):
        async def execute(self, stmt):
            # First query is the auth lookup (user), the next is the lead
            self.calls = getattr(self, "calls", 0) + 1
            return _Result(self.user if self.calls == 1 else other_org_lead)

    db = Mixed(user)

    async def override():
        yield db

    app.dependency_overrides[get_db] = override
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(f"/leads/{other_org_lead.id}/outreach/reject", headers=_bearer(user))
    app.dependency_overrides.clear()
    assert res.status_code == 404


# --- Login ------------------------------------------------------------------

@pytest.mark.anyio
async def test_login_success_returns_working_token(client_with):
    user = _user(role="ae")
    async with client_with(user) as client:
        res = await client.post("/auth/login", json={"email": "Jane@Agency.com", "password": PASSWORD})
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["user"]["role"] == "ae"
        me = await client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
        assert me.status_code == 200
        assert me.json()["email"] == "jane@agency.com"


@pytest.mark.anyio
async def test_login_wrong_password(client_with):
    async with client_with(_user()) as client:
        res = await client.post("/auth/login", json={"email": "jane@agency.com", "password": "nope"})
        assert res.status_code == 401


@pytest.mark.anyio
async def test_login_unknown_user_gives_same_error(client_with):
    async with client_with(None) as client:
        res = await client.post("/auth/login", json={"email": "ghost@agency.com", "password": "nope"})
        assert res.status_code == 401
        assert res.json()["detail"] == "Invalid email or password"


@pytest.mark.anyio
async def test_disabled_user_cannot_log_in(client_with):
    async with client_with(_user(active=False)) as client:
        res = await client.post("/auth/login", json={"email": "jane@agency.com", "password": PASSWORD})
        assert res.status_code == 401


@pytest.mark.anyio
async def test_login_is_throttled_after_five_failures(client_with):
    async with client_with(_user()) as client:
        for _ in range(5):
            assert (await client.post("/auth/login", json={"email": "jane@agency.com", "password": "x"})).status_code == 401
        res = await client.post("/auth/login", json={"email": "jane@agency.com", "password": PASSWORD})
        assert res.status_code == 429


# --- Unsubscribe ------------------------------------------------------------

@pytest.mark.anyio
async def test_unsubscribe_without_token_is_refused(client_with):
    async with client_with() as client:
        res = await client.post("/webhooks/unsubscribe", json={"email": "jane@acme.com"})
        assert res.status_code == 403


@pytest.mark.anyio
async def test_unsubscribe_with_another_addresses_token_is_refused(client_with):
    async with client_with() as client:
        res = await client.post(
            "/webhooks/unsubscribe",
            json={"email": "victim@acme.com", "token": unsubscribe_token("attacker@evil.com")},
        )
        assert res.status_code == 403


@pytest.mark.anyio
async def test_unsubscribe_link_with_valid_token_works(client_with):
    async with client_with(None) as client:  # no matching lead is fine
        res = await client.get(
            "/webhooks/unsubscribe",
            params={"email": "Jane@Acme.com", "token": unsubscribe_token("jane@acme.com")},
        )
        assert res.status_code == 200
        assert "unsubscribed" in res.text
