"""Hosted-deploy plumbing: connection strings, CORS origins and the bootstrap admin."""

from types import SimpleNamespace

import pytest

from apps.api.config import Settings, normalize_database_url
from apps.api.services import bootstrap


@pytest.mark.parametrize("given,expected", [
    # Neon's default snippet
    ("postgresql://u:p@ep-x.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
     "postgresql+asyncpg://u:p@ep-x.aws.neon.tech/neondb?ssl=require"),
    # Neon's SQLAlchemy snippet (psycopg 3)
    ("postgresql+psycopg://u:p@ep-x.aws.neon.tech/neondb?sslmode=require",
     "postgresql+asyncpg://u:p@ep-x.aws.neon.tech/neondb?ssl=require"),
    # Render / Heroku style
    ("postgres://u:p@host:5432/db", "postgresql+asyncpg://u:p@host:5432/db"),
    # Already correct: unchanged
    ("postgresql+asyncpg://leadforge:pw@localhost:5435/leadforge",
     "postgresql+asyncpg://leadforge:pw@localhost:5435/leadforge"),
    # Whitespace from a copy-paste
    ("  postgresql://u:p@h/db  \n", "postgresql+asyncpg://u:p@h/db"),
])
def test_any_postgres_url_spelling_works(given, expected):
    assert normalize_database_url(given) == expected


def test_password_with_special_characters_survives():
    url = "postgresql://user:p%40ss%2Fword@h/db?sslmode=require"
    assert normalize_database_url(url) == "postgresql+asyncpg://user:p%40ss%2Fword@h/db?ssl=require"


def test_cors_origins_ignore_trailing_slash_and_spaces():
    s = Settings(CORS_ORIGINS=" https://lead-forge-u97p.vercel.app/ , http://localhost:3001")
    assert s.cors_origin_list == ["https://lead-forge-u97p.vercel.app", "http://localhost:3001"]


# --- Bootstrap admin -----------------------------------------------------------

class _Result:
    def __init__(self, value):
        self._value = value

    def scalars(self):
        return self

    def first(self):
        return self._value


class FakeSession:
    def __init__(self, user=None, org=None):
        self.answers = [user, org]
        self.added = []
        self.committed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def execute(self, _stmt):
        return _Result(self.answers.pop(0) if self.answers else None)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass

    async def commit(self):
        self.committed = True


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _configure(monkeypatch, email, password, session):
    monkeypatch.setattr(bootstrap.settings, "BOOTSTRAP_ADMIN_EMAIL", email)
    monkeypatch.setattr(bootstrap.settings, "BOOTSTRAP_ADMIN_PASSWORD", password)
    monkeypatch.setattr(bootstrap, "SessionLocal", lambda: session)


@pytest.mark.anyio
async def test_bootstrap_is_off_by_default(monkeypatch):
    session = FakeSession()
    _configure(monkeypatch, "", "", session)
    assert await bootstrap.ensure_bootstrap_admin() == "disabled"
    assert session.added == []


@pytest.mark.anyio
async def test_bootstrap_rejects_short_password(monkeypatch):
    session = FakeSession()
    _configure(monkeypatch, "boss@agency.com", "short", session)
    assert await bootstrap.ensure_bootstrap_admin() == "invalid"
    assert session.added == []


@pytest.mark.anyio
async def test_bootstrap_creates_missing_admin(monkeypatch):
    org = SimpleNamespace(id="org-1")
    session = FakeSession(user=None, org=org)
    _configure(monkeypatch, " Boss@Agency.com ", "a-long-enough-password", session)
    assert await bootstrap.ensure_bootstrap_admin() == "created"
    (user,) = session.added
    assert user.email == "boss@agency.com" and user.role == "admin" and user.is_active
    assert user.password_hash.startswith("scrypt$")
    assert session.committed


@pytest.mark.anyio
async def test_bootstrap_never_changes_an_existing_user(monkeypatch):
    existing = SimpleNamespace(email="boss@agency.com", password_hash="scrypt$old", role="ops")
    session = FakeSession(user=existing)
    _configure(monkeypatch, "boss@agency.com", "a-long-enough-password", session)
    assert await bootstrap.ensure_bootstrap_admin() == "exists"
    assert existing.password_hash == "scrypt$old" and existing.role == "ops"
    assert session.added == []
