from sqlalchemy import Column, String, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from .base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=True)
    role = Column(String, nullable=False)  # 'admin', 'ae', 'ops'
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
