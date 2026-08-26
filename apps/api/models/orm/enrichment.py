from sqlalchemy import Column, String, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .base import Base

class EnrichmentData(Base):
    __tablename__ = "enrichment_data"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), unique=True, nullable=False)
    seniority = Column(String, nullable=True)
    department = Column(String, nullable=True)
    hiring_signals = Column(JSONB, nullable=False, server_default=text("'[]'"))
    news_triggers = Column(JSONB, nullable=False, server_default=text("'[]'"))
    enriched_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
