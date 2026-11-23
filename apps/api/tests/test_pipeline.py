"""Pipeline state machine, sending and opt-out tests that run without a database.

The DB session is a fake that answers queries in order, so these exercise the
real routes and services.
"""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException

from apps.api.auth.security import create_access_token, unsubscribe_token
from apps.api.clients import email_client
from apps.api.clients.email_client import EmailSendError, build_message
from apps.api.db.session import get_db
from apps.api.main import app
from apps.api.models.schemas import LeadInput, ResearchBrief
from apps.api.routers import outreach_router, poc
from apps.api.services import lead_state, outreach_service
from apps.api.services.lead_state import allowed_actions, require_transition

ORG_ID = uuid.uuid4()


@pytest.fixture
def anyio_backend():
    return "asyncio"


# --- State machine -----------------------------------------------------------

@pytest.mark.parametrize("action,stage,ok", [
    ("research", "new", True),
    ("research", "scored", True),
    ("research", "outreach_sent", False),
    ("research", "unsubscribed", False),
    ("score", "new", False),
    ("score", "researched", True),
    ("score", "booked", False),
    ("draft", "researched", False),
    ("draft", "scored", True),
    ("draft", "outreach_drafted", True),
    ("approve", "scored", False),
    ("approve", "outreach_drafted", True),
    ("reject", "outreach_sent", False),
])
def test_transitions(action, stage, ok):
    lead = SimpleNamespace(stage=stage, do_not_contact=False)
    if ok:
        require_transition(lead, action)
    else:
        with pytest.raises(HTTPException) as exc:
            require_transition(lead, action)
        assert exc.value.status_code == 409


@pytest.mark.parametrize("action", list(lead_state.TRANSITIONS))
def test_opted_out_lead_blocks_every_action(action):
    stage = next(iter(lead_state.TRANSITIONS[action]))
    with pytest.raises(HTTPException) as exc:
        require_transition(SimpleNamespace(stage=stage, do_not_contact=True), action)
    assert exc.value.status_code == 400
    assert "Do Not Contact" in exc.value.detail


def test_every_transition_stage_is_a_real_stage():
    for stages in lead_state.TRANSITIONS.values():
        assert stages <= set(lead_state.STAGES)
    assert set(lead_state.RESULT_STAGE.values()) <= set(lead_state.STAGES)


def test_allowed_actions():
    assert allowed_actions("new") == ["research"]
    assert set(allowed_actions("scored")) == {"research", "score", "draft"}
    assert allowed_actions("outreach_drafted", do_not_contact=True) == []


# --- Fake DB -------------------------------------------------------------------

class _Result:
    def __init__(self, value):
        self._value = value

    def scalars(self):
        return self

    def first(self):
        return self._value

    def all(self):
        return [] if self._value is None else [self._value]

    def scalar(self):
        return self._value


class SeqDB:
    """Answers each execute() with the next value in `answers` (then None)."""

    def __init__(self, *answers):
        self.answers = list(answers)
        self.added = []
        self.commits = 0
        self.rollbacks = 0

    async def execute(self, _stmt):
        return _Result(self.answers.pop(0) if self.answers else None)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1

    async def flush(self):
        pass


def _user(role="ae"):
    return SimpleNamespace(id=uuid.uuid4(), org_id=ORG_ID, email="ae@agency.com", name="AE",
                           role=role, is_active=True)


def _lead(stage="outreach_drafted", dnc=False):
    return SimpleNamespace(id=uuid.uuid4(), org_id=ORG_ID, email="jane@acme.com", stage=stage,
                           do_not_contact=dnc, full_name="Jane Doe", title="CMO", company_id=uuid.uuid4())


def _draft():
    return SimpleNamespace(id=uuid.uuid4(), subject="Hello", body="Stored body", status="draft",
                           sent_at=None, approved_by=None)


def _client(db):
    async def override():
        yield db

    app.dependency_overrides[get_db] = override
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


def _bearer(user):
    token, _ = create_access_token(user.id, user.role, user.org_id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


# --- Approve / send --------------------------------------------------------------

@pytest.mark.anyio
@pytest.mark.parametrize("payload", [{"subject": ""}, {"body": "   "}, {"subject": "Hi", "body": ""}])
async def test_approve_rejects_empty_subject_or_body(payload):
    user = _user()
    async with _client(SeqDB(user)) as client:
        res = await client.post(f"/leads/{uuid.uuid4()}/outreach/approve", json=payload, headers=_bearer(user))
    assert res.status_code == 422


@pytest.mark.anyio
async def test_approve_sends_and_marks_message_sent(monkeypatch):
    user, lead, msg = _user(), _lead(), _draft()
    sent = AsyncMock(return_value="mock")
    monkeypatch.setattr(outreach_router, "send_email", sent)
    db = SeqDB(user, lead, msg)

    async with _client(db) as client:
        res = await client.post(f"/leads/{lead.id}/outreach/approve",
                                json={"subject": "Edited", "body": "Edited body"}, headers=_bearer(user))

    assert res.status_code == 200, res.text
    assert res.json()["status"] == "sent"
    assert msg.status == "sent" and msg.sent_at is not None
    assert msg.approved_by == user.id
    assert lead.stage == "outreach_sent"
    kwargs = sent.await_args.kwargs
    assert kwargs["subject"] == "Edited"
    assert kwargs["body"].startswith("Edited body")
    assert "Unsubscribe:" in kwargs["body"]
    assert unsubscribe_token("jane@acme.com") in kwargs["unsubscribe_url"]
    assert db.commits == 1


@pytest.mark.anyio
async def test_failed_send_keeps_the_draft_and_returns_502(monkeypatch):
    user, lead, msg = _user(), _lead(), _draft()
    monkeypatch.setattr(outreach_router, "send_email", AsyncMock(side_effect=EmailSendError("smtp down")))
    db = SeqDB(user, lead, msg)

    async with _client(db) as client:
        res = await client.post(f"/leads/{lead.id}/outreach/approve", headers=_bearer(user))

    assert res.status_code == 502
    assert msg.status == "draft"
    assert lead.stage == "outreach_drafted"
    assert db.rollbacks >= 1
    assert any(type(o).__name__ == "PipelineError" for o in db.added)


@pytest.mark.anyio
async def test_approve_refused_for_opted_out_lead(monkeypatch):
    user = _user()
    sent = AsyncMock()
    monkeypatch.setattr(outreach_router, "send_email", sent)
    async with _client(SeqDB(user, _lead(stage="unsubscribed", dnc=True))) as client:
        res = await client.post(f"/leads/{uuid.uuid4()}/outreach/approve", headers=_bearer(user))
    assert res.status_code == 400
    sent.assert_not_awaited()


@pytest.mark.anyio
async def test_research_on_sent_lead_is_a_conflict():
    user = _user(role="ops")
    async with _client(SeqDB(user, _lead(stage="outreach_sent"))) as client:
        res = await client.post(f"/leads/{uuid.uuid4()}/research", headers=_bearer(user))
    assert res.status_code == 409


def test_message_has_one_click_unsubscribe_headers():
    msg = build_message("jane@acme.com", "Hi", "Body", "https://api.example.com/webhooks/unsubscribe?x=1")
    assert msg["List-Unsubscribe"] == "<https://api.example.com/webhooks/unsubscribe?x=1>"
    assert msg["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"


@pytest.mark.anyio
async def test_send_email_mocks_without_smtp_credentials(monkeypatch):
    monkeypatch.setattr(email_client.settings, "SMTP_USERNAME", "")
    monkeypatch.setattr(email_client.settings, "SMTP_PASSWORD", "")
    assert await email_client.send_email("a@b.com", "s", "b", "https://x/u") == "mock"


# --- Drafting ------------------------------------------------------------------------

@pytest.mark.anyio
async def test_draft_refused_when_research_flagged_insufficient_signal(monkeypatch):
    called = AsyncMock()
    monkeypatch.setattr(outreach_service, "call_structured", called)
    brief = SimpleNamespace(summary="thin", personalization_angles=[], insufficient_signal=True)
    with pytest.raises(outreach_service.InsufficientSignalError):
        await outreach_service.draft_outreach_db(SeqDB(), _lead(stage="scored"), SimpleNamespace(name="Acme"), brief)
    called.assert_not_awaited()


# --- Unsubscribe (RFC 8058) ----------------------------------------------------------

@pytest.mark.anyio
async def test_one_click_form_post_unsubscribes():
    lead = _lead(stage="outreach_sent")
    db = SeqDB([lead])  # the lead lookup returns a list via .all()

    class ListDB(SeqDB):
        async def execute(self, stmt):
            r = await super().execute(stmt)
            if isinstance(r._value, list):
                return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: r._value))
            return r

    db = ListDB([lead])
    async with _client(db) as client:
        res = await client.post(
            "/webhooks/unsubscribe",
            params={"email": "jane@acme.com", "token": unsubscribe_token("jane@acme.com")},
            content="List-Unsubscribe=One-Click",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    assert res.status_code == 200, res.text
    assert res.json()["updated"] == 1
    assert lead.do_not_contact is True and lead.stage == "unsubscribed"


@pytest.mark.anyio
async def test_one_click_form_post_without_token_is_refused():
    async with _client(SeqDB()) as client:
        res = await client.post(
            "/webhooks/unsubscribe",
            params={"email": "jane@acme.com"},
            content="List-Unsubscribe=One-Click",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    assert res.status_code == 403


# --- POC dry run ------------------------------------------------------------------------

@pytest.mark.anyio
async def test_poc_dry_run(monkeypatch):
    monkeypatch.setattr(poc, "research_from_input", AsyncMock(return_value=ResearchBrief(
        summary="Growing fast", personalization_angles=["Hiring growth roles"], insufficient_signal=False)))
    monkeypatch.setattr(outreach_service, "call_structured", AsyncMock(return_value={"subject": "Hi", "body": "Hello"}))
    monkeypatch.setattr(poc, "append_result", lambda result: None)

    lead = LeadInput(company_name="Acme", domain="acme.com", industry="saas", employee_count=80,
                     funding_stage="Series A", hiring_signals=["Growth Marketer"], news_triggers=["Raised"],
                     full_name="Jane Doe", title="CMO", email="jane@acme.com", email_verified=True,
                     linkedin_url="https://linkedin.com/in/jane")
    result = await poc.process_lead(lead)
    assert result.score.tier in ("hot", "warm")
    assert result.outreach is not None and result.outreach.subject == "Hi"
