from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .base import Base

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    icp_filter = Column(JSONB, nullable=False, server_default=text("'{}'"))
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
