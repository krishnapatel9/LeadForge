from sqlalchemy import Column, String, DateTime, Boolean, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .base import Base

class PipelineError(Base):
    __tablename__ = "pipeline_errors"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    stage = Column(String, nullable=False)
    payload = Column(JSONB, nullable=True)
    error_message = Column(String, nullable=True)
    resolved = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
