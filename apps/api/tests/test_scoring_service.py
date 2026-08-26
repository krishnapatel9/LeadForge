from apps.api.models.schemas import LeadInput
from apps.api.services.scoring_service import score_lead


def _base_lead(**overrides) -> LeadInput:
    defaults = dict(
        company_name="Acme SaaS",
        domain="acme.com",
        full_name="Jane Doe",
        title="VP Marketing",
        email="jane@acme.com",
    )
    defaults.update(overrides)
    return LeadInput(**defaults)


def test_strong_icp_fit_scores_full_fit_points():
    lead = _base_lead(industry="saas", employee_count=80)
    score = score_lead(lead)
    assert score.fit_score == 30


def test_poor_industry_fit_gets_partial_credit_not_zero():
    lead = _base_lead(industry="manufacturing", employee_count=80)
    score = score_lead(lead)
    assert 0 < score.fit_score < 30


def test_no_signals_scores_as_cool():
    lead = _base_lead()
    score = score_lead(lead)
    assert score.tier == "cool"
    assert score.total_score < 40


def test_hot_lead_hits_seventy_plus_with_strong_signals():
    lead = _base_lead(
        industry="saas",
        employee_count=80,
        funding_stage="Series B",
        hiring_signals=["Growth Marketer", "Demand Gen Manager"],
        news_triggers=["Raised $15M Series B"],
        email_verified=True,
        linkedin_url="https://linkedin.com/in/janedoe",
    )
    score = score_lead(lead)
    assert score.tier == "hot"
    assert score.total_score >= 70


def test_engagement_score_only_applies_with_prior_engagement():
    lead = _base_lead(has_prior_engagement=True)
    score = score_lead(lead)
    assert score.engagement_score == 10

    lead_no_engagement = _base_lead(has_prior_engagement=False)
    assert score_lead(lead_no_engagement).engagement_score == 0


def test_total_score_is_sum_of_components():
    lead = _base_lead(industry="saas", employee_count=80, funding_stage="Series A")
    score = score_lead(lead)
    assert score.total_score == (
        score.fit_score + score.intent_score + score.gap_score
        + score.contactability_score + score.engagement_score
    )
