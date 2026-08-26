from sqlalchemy import Column, String, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from .base import Base

class FollowUp(Base):
    __tablename__ = "follow_ups"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    scheduled_for = Column(DateTime(timezone=True), nullable=False)
    status = Column(String, nullable=False, server_default=text("'pending'")) # 'pending' | 'sent' | 'skipped_replied' | 'skipped_dnc'
