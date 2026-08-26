from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, text
from sqlalchemy.dialects.postgresql import UUID
from .base import Base

class OutreachMessage(Base):
    __tablename__ = "outreach_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    sequence_step = Column(Integer, nullable=False, default=1)
    subject = Column(String, nullable=False)
    body = Column(String, nullable=False)
    status = Column(String, nullable=False, server_default=text("'draft'")) # 'draft' | 'approved' | 'sent' | 'rejected'
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    replied_at = Column(DateTime(timezone=True), nullable=True)
    bounced = Column(Boolean, nullable=False, default=False)
    prompt_version = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
