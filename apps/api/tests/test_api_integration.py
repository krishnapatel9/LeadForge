import pytest
import httpx
from unittest.mock import patch
import uuid

from sqlalchemy.future import select

from apps.api.auth.security import hash_password, unsubscribe_token
from apps.api.db.session import SessionLocal
from apps.api.main import app
from apps.api.models.orm.organization import Organization
from apps.api.models.orm.user import User


async def _create_test_user(role: str) -> tuple[str, str]:
    """Creates a throwaway user in the live test database and returns (email, password)."""
    email = f"test-{role}-{uuid.uuid4().hex[:8]}@agency-test.com"
    password = uuid.uuid4().hex
    async with SessionLocal() as db:
        org = (await db.execute(select(Organization).limit(1))).scalars().first()
        db.add(User(org_id=org.id, email=email, role=role,
                    password_hash=hash_password(password), is_active=True))
        await db.commit()
    return email, password


@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.mark.anyio
@patch("apps.api.services.research_service.call_structured")
@patch("apps.api.services.outreach_service.call_structured")
async def test_full_lead_pipeline(mock_outreach, mock_research):
    # Setup mock LLM return values
    mock_research.return_value = {
        "summary": "This company has growth and marketing pains.",
        "personalization_angles": ["Angle 1: hiring growth marketer", "Angle 2: missing senior CMO"],
        "insufficient_signal": False
    }
    
    mock_outreach.return_value = {
        "subject": "Quick question about growth for Acme SaaS",
        "body": "Hi Jane, noticed you are hiring growth marketers..."
    }

    # Use ASGITransport to test backend directly via ASGI loop (httpx >= 0.20 style)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 0. Test health endpoints
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

        # Everything else requires sign-in now
        response = await client.get("/leads")
        assert response.status_code == 401

        email, password = await _create_test_user(role="admin")
        response = await client.post("/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200, response.text
        client.headers["Authorization"] = f"Bearer {response.json()['access_token']}"

        response = await client.get("/system-health")
        assert response.status_code == 200
        data = response.json()
        assert "database" in data
        assert "gemini_api" in data
        assert "unresolved_pipeline_errors" in data

        # 1. Ingest a lead
        lead_payload = {
            "company_name": f"Acme SaaS Integration Test {uuid.uuid4().hex[:6]}",
            "domain": f"acme-test-{uuid.uuid4().hex[:6]}.com",
            "industry": "saas",
            "employee_count": 80,
            "revenue_band": "$1M-$5M",
            "funding_stage": "Series A",
            "tech_stack": ["Hubspot", "Postgres"],
            "hiring_signals": ["Growth Marketer"],
            "news_triggers": ["Secured Series A funding"],
            "full_name": "Jane Test",
            "title": "VP Growth",
            "email": f"test-lead-{uuid.uuid4().hex[:6]}@acme-test.com",
            "linkedin_url": "https://linkedin.com/in/janetest",
            "email_verified": True,
            "has_prior_engagement": False
        }

        response = await client.post("/leads/ingest", json=lead_payload)
        assert response.status_code == 201, response.text
        data = response.json()
        assert data["status"] == "ingested"
        lead_id = data["lead_id"]
        assert lead_id is not None

        # Check duplicate ingestion
        response_dup = await client.post("/leads/ingest", json=lead_payload)
        assert response_dup.status_code == 201, response_dup.text
        data_dup = response_dup.json()
        assert data_dup["status"] == "skipped"
        assert data_dup["reason"] == "recent_duplicate"
        assert data_dup["lead_id"] == lead_id

        # 2. Research Lead
        response = await client.post(f"/leads/{lead_id}/research")
        assert response.status_code == 200, response.text
        brief = response.json()
        assert brief["summary"] == "This company has growth and marketing pains."
        assert "Angle 1: hiring growth marketer" in brief["personalization_angles"]

        # 3. Score Lead
        response = await client.post(f"/leads/{lead_id}/score")
        assert response.status_code == 200, response.text
        score_breakdown = response.json()
        assert score_breakdown["total_score"] > 0
        assert score_breakdown["tier"] in ["hot", "warm", "cool"]

        # 4. Draft Outreach
        response = await client.post(f"/leads/{lead_id}/draft-outreach")
        assert response.status_code == 200, response.text
        draft = response.json()
        assert draft["subject"] == "Quick question about growth for Acme SaaS"
        assert "Hi Jane" in draft["body"]

        # 5. List Leads
        response = await client.get("/leads")
        assert response.status_code == 200
        leads_list = response.json()
        found_lead = [l for l in leads_list if l["id"] == lead_id]
        assert len(found_lead) == 1
        assert found_lead[0]["stage"] == "outreach_drafted"
        assert found_lead[0]["total_score"] == score_breakdown["total_score"]

        # 6. Approve Outreach
        response = await client.post(f"/leads/{lead_id}/outreach/approve")
        assert response.status_code == 200
        assert response.json()["status"] == "approved"

        # 7. Get Lead Details
        response = await client.get(f"/leads/{lead_id}")
        assert response.status_code == 200
        detail = response.json()
        assert detail["lead"]["id"] == lead_id
        assert detail["company"]["name"].startswith("Acme SaaS Integration Test")
        assert detail["research"]["summary"] == "This company has growth and marketing pains."
        assert detail["score"]["total_score"] == score_breakdown["total_score"]
        assert len(detail["outreach"]) == 1
        assert detail["outreach"][0]["status"] == "approved"

        # 8. Test Unsubscribe Webhook & Do Not Contact enforcement
        # Create a second lead to test workflow
        lead2_payload = dict(lead_payload)
        lead2_payload["email"] = f"dnc-test-{uuid.uuid4().hex[:6]}@acme-test.com"
        lead2_payload["company_name"] = f"DNC Test Co {uuid.uuid4().hex[:6]}"
        
        response = await client.post("/leads/ingest", json=lead2_payload)
        assert response.status_code == 201
        lead2_id = response.json()["lead_id"]

        # Run pipeline up to draft
        await client.post(f"/leads/{lead2_id}/research")
        await client.post(f"/leads/{lead2_id}/score")
        await client.post(f"/leads/{lead2_id}/draft-outreach")

        # Verify it has a draft
        response = await client.get(f"/leads/{lead2_id}")
        assert len(response.json()["outreach"]) == 1
        assert response.json()["outreach"][0]["status"] == "draft"

        # An unsigned unsubscribe request is refused
        response = await client.post("/webhooks/unsubscribe", json={"email": lead2_payload["email"]})
        assert response.status_code == 403

        # Trigger unsubscribe webhook with the signed token from the email link
        unsub_payload = {"email": lead2_payload["email"], "token": unsubscribe_token(lead2_payload["email"])}
        response = await client.post("/webhooks/unsubscribe", json=unsub_payload)
        assert response.status_code == 200
        assert response.json()["status"] == "unsubscribed"
        assert response.json()["updated"] == 1

        # Attempt to approve draft outreach (should fail because of Do Not Contact)
        response = await client.post(f"/leads/{lead2_id}/outreach/approve")
        assert response.status_code == 400
        assert "Do Not Contact" in response.json()["detail"]

