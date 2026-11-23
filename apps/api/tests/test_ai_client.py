"""AI client error handling: what's retried, and what the dashboard is told."""

from types import SimpleNamespace

import pytest
from google.genai import errors as genai_errors

from apps.api.clients import ai_client


def _api_error(code: int, message: str, status: str = "ERROR") -> genai_errors.APIError:
    return genai_errors.APIError(code, {"error": {"code": code, "message": message, "status": status}})


class FakeModels:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0

    async def generate_content(self, **_kwargs):
        self.calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return SimpleNamespace(text=outcome)


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def fake_gemini(monkeypatch):
    def install(*outcomes):
        models = FakeModels(outcomes)
        client = SimpleNamespace(aio=SimpleNamespace(models=models))
        monkeypatch.setattr(ai_client, "_get_client", lambda: client)

        async def no_sleep(_seconds):
            pass

        monkeypatch.setattr(ai_client.asyncio, "sleep", no_sleep)
        return models

    return install


VARS = dict(company_name="Acme", domain="acme.example", industry="SaaS", employee_count=50,
            revenue_band="unknown", funding_stage="Seed", tech_stack="none", hiring_signals="none",
            news_triggers="none", full_name="Jane", title="CMO")


@pytest.mark.anyio
async def test_invalid_key_fails_once_with_a_plain_message(fake_gemini):
    models = fake_gemini(_api_error(400, "API key not valid. Please pass a valid API key.", "INVALID_ARGUMENT"))
    with pytest.raises(ai_client.AIError) as exc:
        await ai_client.call_structured("research_brief_v1", VARS)
    assert models.calls == 1  # not retried: it can never succeed
    assert "rejected the API key" in str(exc.value)
    assert "{" not in str(exc.value)  # no raw JSON for the dashboard
    assert isinstance(exc.value.__cause__, genai_errors.APIError)  # raw error kept for the log


@pytest.mark.anyio
async def test_rate_limit_is_retried_then_succeeds(fake_gemini):
    models = fake_gemini(_api_error(429, "Resource exhausted", "RESOURCE_EXHAUSTED"),
                         '{"summary": "ok", "personalization_angles": [], "insufficient_signal": false}')
    result = await ai_client.call_structured("research_brief_v1", VARS)
    assert result["summary"] == "ok"
    assert models.calls == 2


@pytest.mark.anyio
async def test_persistent_rate_limit_gives_a_wait_message(fake_gemini):
    models = fake_gemini(*[_api_error(429, "Resource exhausted", "RESOURCE_EXHAUSTED")] * 3)
    with pytest.raises(ai_client.AIError) as exc:
        await ai_client.call_structured("research_brief_v1", VARS)
    assert models.calls == 3
    assert "rate limit" in str(exc.value)


@pytest.mark.anyio
async def test_broken_json_is_retried(fake_gemini):
    models = fake_gemini("not json", '```json\n{"subject": "Hi", "body": "Hello"}\n```')
    result = await ai_client.call_structured("outreach_draft_v1", dict(
        agency_context="x", full_name="Jane", title="CMO", company_name="Acme",
        research_summary="s", personalization_angles="a"))
    assert result == {"subject": "Hi", "body": "Hello"}
    assert models.calls == 2


@pytest.mark.parametrize("code,expected", [
    (404, "isn't available"),
    (503, "having problems"),
    (403, "rejected the API key"),
])
def test_friendly_messages(code, expected):
    assert expected in ai_client.friendly_error(_api_error(code, "x"))
