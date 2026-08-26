from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, text
from sqlalchemy.dialects.postgresql import UUID
from .base import Base

class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=True)
    full_name = Column(String, nullable=False)
    title = Column(String, nullable=True)
    email = Column(String, unique=True, nullable=False)
    linkedin_url = Column(String, nullable=True)
    email_verified = Column(Boolean, nullable=False, default=False)
    stage = Column(String, nullable=False, server_default=text("'new'"))
    do_not_contact = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"), onupdate=text("now()"))
