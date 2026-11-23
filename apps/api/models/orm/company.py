from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .base import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    domain = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    industry = Column(String, nullable=True)
    employee_count = Column(Integer, nullable=True)
    revenue_band = Column(String, nullable=True)
    funding_stage = Column(String, nullable=True)
    tech_stack = Column(JSONB, nullable=False, server_default=text("'[]'"))
    source = Column(String, nullable=False, server_default=text("'apollo'"))
    raw_enrichment = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    # Last firmographic refresh; staleness is measured from this, not created_at
    enriched_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
