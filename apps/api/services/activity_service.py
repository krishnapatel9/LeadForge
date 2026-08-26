import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.models.orm.activity_log import ActivityLog

async def log_activity(
    db: AsyncSession,
    lead_id: uuid.UUID,
    actor: str,
    action: str,
    detail: dict | None = None
) -> ActivityLog:
    """Creates a new activity log entry for the lead."""
    log_entry = ActivityLog(
        lead_id=lead_id,
        actor=actor,
        action=action,
        detail=detail or {}
    )
    db.add(log_entry)
    return log_entry
