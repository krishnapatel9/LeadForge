from sqlalchemy import func
from sqlalchemy.future import select

from apps.api.models.orm.lead_score import LeadScore


def latest_score_subquery():
    """One row per lead: its most recent score (columns lead_id, tier, total_score).
    Join it instead of querying the score once per lead."""
    ranked = select(
        LeadScore.lead_id,
        LeadScore.tier,
        LeadScore.total_score,
        func.row_number()
        .over(partition_by=LeadScore.lead_id, order_by=LeadScore.created_at.desc())
        .label("rn"),
    ).subquery()
    return (
        select(ranked.c.lead_id, ranked.c.tier, ranked.c.total_score)
        .where(ranked.c.rn == 1)
        .subquery("latest_score")
    )
