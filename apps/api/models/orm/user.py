from sqlalchemy import Boolean, Column, String, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from .base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=True)
    role = Column(String, nullable=False)  # 'admin', 'ae', 'ops'
    password_hash = Column(String, nullable=True)  # null = cannot sign in
    is_active = Column(Boolean, nullable=False, server_default=text("true"), default=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
