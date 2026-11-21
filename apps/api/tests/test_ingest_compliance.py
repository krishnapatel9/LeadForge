"""Regression tests for the ingest / dedupe / opt-out bugs (audit B-1, B-2, B-3).

These run without a database: the DB session and dedupe lookup are faked, so
they check the ingest decisions themselves.
"""

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from apps.api.models.schemas import LeadInput
from apps.api.routers import leads_router
from apps.api.services.dedupe_service import _is_stale
from apps.api.services.normalize import normalize_domain, normalize_email


def _lead_input(**overrides) -> LeadInput:
    data = dict(
        company_name="Acme SaaS",
        domain="acme.com",
        full_name="Jane Doe",
        title="VP Marketing",
        email="jane@acme.com",
    )
    data.update(overrides)
    return LeadInput(**data)


# --- B-3: canonical emails and domains -------------------------------------

@pytest.mark.parametrize("raw,expected", [
    ("Jane.Doe@Acme.com", "jane.doe@acme.com"),
    ("  JANE@ACME.COM \n", "jane@acme.com"),
])
def test_normalize_email(raw, expected):
    assert normalize_email(raw) == expected


@pytest.mark.parametrize("raw,expected", [
    ("Acme.com", "acme.com"),
    ("www.acme.com", "acme.com"),
    ("https://www.Acme.com/about?x=1", "acme.com"),
    ("acme.com.", "acme.com"),
])
def test_normalize_domain(raw, expected):
    assert normalize_domain(raw) == expected


def test_lead_input_stores_canonical_email_and_domain():
    lead = _lead_input(email="Jane.Doe@Acme.com", domain="https://www.ACME.com/")
    assert lead.email == "jane.doe@acme.com"
    assert lead.domain == "acme.com"


@pytest.mark.parametrize("bad", ["not-an-email", "@acme.com", "jane@"])
def test_lead_input_rejects_invalid_email(bad):
    with pytest.raises(ValidationError):
        _lead_input(email=bad)


# --- B-2: staleness is measured from the last refresh -----------------------

def test_recently_refreshed_lead_is_not_stale():
    now = datetime(2026, 11, 21, tzinfo=timezone.utc)
    assert not _is_stale(now - timedelta(days=10), now)


def test_lead_refreshed_long_ago_is_stale():
    now = datetime(2026, 11, 21, tzinfo=timezone.utc)
    assert _is_stale(now - timedelta(days=91), now)


# --- B-1 / B-2: ingest never re-activates or regresses a lead ---------------

class _Result:
    def __init__(self, value):
        self._value = value

    def scalars(self):
        return self

    def first(self):
        return self._value


class FakeSession:
    """Just enough of AsyncSession for ingest_lead."""

    def __init__(self):
        self.org = SimpleNamespace(id=uuid.uuid4())
        self.added = []
        self.committed = False

    async def execute(self, _stmt):
        return _Result(self.org)  # only the organisation lookup reaches here

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass

    async def commit(self):
        self.committed = True


def _existing_lead(**overrides):
    data = dict(
        id=uuid.uuid4(),
        company_id=uuid.uuid4(),
        email="jane@acme.com",
        full_name="Jane Doe",
        title="VP Marketing",
        linkedin_url=None,
        email_verified=False,
        stage="booked",
        do_not_contact=False,
    )
    data.update(overrides)
    return SimpleNamespace(**data)


@pytest.fixture
def patch_ingest(monkeypatch):
    """Fakes the dedupe lookups and the activity log."""

    def _apply(lead, enrichment=None, lead_is_recent=False):
        company = SimpleNamespace(id=lead.company_id if lead else uuid.uuid4(), domain="acme.com")

        async def fake_lead_dup(db, email):
            return lead_is_recent, lead, enrichment

        async def fake_company_dup(db, domain):
            return True, company

        async def fake_log_activity(**kwargs):
            pass

        monkeypatch.setattr(leads_router, "check_lead_duplicate", fake_lead_dup)
        monkeypatch.setattr(leads_router, "check_company_duplicate", fake_company_dup)
        monkeypatch.setattr(leads_router, "log_activity", fake_log_activity)

    return _apply


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_opted_out_lead_is_skipped_and_untouched(patch_ingest, anyio_backend):
    lead = _existing_lead(do_not_contact=True, stage="unsubscribed")
    patch_ingest(lead)  # stale, which used to reset do_not_contact to False
    db = FakeSession()

    result = await leads_router.ingest_lead(_lead_input(full_name="Changed Name"), db)

    assert result.status == "skipped"
    assert result.reason == "do_not_contact"
    assert lead.do_not_contact is True
    assert lead.stage == "unsubscribed"
    assert lead.full_name == "Jane Doe"
    assert not db.committed


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_stale_refresh_keeps_progressed_stage(patch_ingest, anyio_backend):
    lead = _existing_lead(stage="booked")
    enrichment = SimpleNamespace(hiring_signals=[], news_triggers=[], enriched_at=None)
    patch_ingest(lead, enrichment)
    db = FakeSession()

    result = await leads_router.ingest_lead(_lead_input(title="CMO", hiring_signals=["Growth Lead"]), db)

    assert result.status == "ingested"
    assert lead.stage == "booked"          # not reset to "new"
    assert lead.do_not_contact is False
    assert lead.title == "CMO"             # data was refreshed
    assert enrichment.hiring_signals == ["Growth Lead"]
    assert enrichment.enriched_at is not None  # refresh time moved forward
    assert db.committed


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_stale_refresh_resets_early_stage_for_new_research(patch_ingest, anyio_backend):
    lead = _existing_lead(stage="scored")
    patch_ingest(lead, SimpleNamespace(hiring_signals=[], news_triggers=[], enriched_at=None))

    await leads_router.ingest_lead(_lead_input(), FakeSession())

    assert lead.stage == "new"
