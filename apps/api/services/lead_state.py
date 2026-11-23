"""The lead pipeline as one explicit state machine.

Every step (research, score, draft, approve, reject) checks here before it runs,
so no step can move a lead backwards or act on a lead that opted out. The stage
names mirror the CHECK constraint in db/migrations/0001_init.sql, and the
dashboard mirrors TRANSITIONS in lib/stages.ts.
"""

from fastapi import HTTPException, status

STAGES = (
    "new", "enriched", "researched", "scored", "outreach_drafted",
    "outreach_sent", "replied", "booked", "won", "lost", "unsubscribed",
)

# action -> stages the lead may be in for that action to run
TRANSITIONS: dict[str, frozenset[str]] = {
    "research": frozenset({"new", "enriched", "researched", "scored"}),
    "score": frozenset({"researched", "scored"}),
    "draft": frozenset({"scored", "outreach_drafted"}),
    "approve": frozenset({"outreach_drafted"}),
    "reject": frozenset({"outreach_drafted"}),
}

# action -> stage the lead ends in once the action succeeds
RESULT_STAGE = {
    "research": "researched",
    "score": "scored",
    "draft": "outreach_drafted",
    "approve": "outreach_sent",
    "reject": "scored",
}


def allowed_actions(stage: str, do_not_contact: bool = False) -> list[str]:
    if do_not_contact:
        return []
    return [action for action, stages in TRANSITIONS.items() if stage in stages]


def require_transition(lead, action: str) -> None:
    """Raises 400 for an opted-out lead and 409 when the lead's stage doesn't allow `action`."""
    if getattr(lead, "do_not_contact", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This lead has opted out of communication (Do Not Contact).",
        )
    if lead.stage not in TRANSITIONS[action]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Can't {action} a lead in stage '{lead.stage}'.",
        )


def advance(lead, action: str) -> None:
    lead.stage = RESULT_STAGE[action]
