from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from .base import Base

class LeadScore(Base):
    __tablename__ = "lead_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    fit_score = Column(Integer, nullable=False)
    intent_score = Column(Integer, nullable=False)
    gap_score = Column(Integer, nullable=False)
    contactability_score = Column(Integer, nullable=False)
    engagement_score = Column(Integer, nullable=False)
    total_score = Column(Integer, nullable=False)
    tier = Column(String, nullable=False) # 'hot' | 'warm' | 'cool'
    scoring_version = Column(String, nullable=False, server_default=text("'v1'"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
