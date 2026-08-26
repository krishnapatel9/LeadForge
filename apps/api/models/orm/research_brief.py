from sqlalchemy import Column, String, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .base import Base

class ResearchBrief(Base):
    __tablename__ = "research_briefs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    summary = Column(String, nullable=False)
    personalization_angles = Column(JSONB, nullable=False, server_default=text("'[]'"))
    model_used = Column(String, nullable=True)
    prompt_version = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
