from sqlalchemy import Column, String, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .base import Base

class ActivityLog(Base):
    __tablename__ = "activity_log"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    actor = Column(String, nullable=False) # 'system' or user email
    action = Column(String, nullable=False) # e.g. 'stage_changed', 'outreach_approved'
    detail = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
