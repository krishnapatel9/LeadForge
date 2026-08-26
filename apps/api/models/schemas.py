from pydantic import BaseModel, Field


import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class LeadInput(BaseModel):
    """Raw lead payload as it would arrive from Apollo + Clay enrichment.
    Phase 1 POC accepts this directly; Phase 2 splits ingest/enrich/research/score
    into separate persisted steps per the Backend Schema doc.
    """

    company_name: str
    domain: str
    industry: str | None = None
    employee_count: int | None = None
    revenue_band: str | None = None
    funding_stage: str | None = None
    tech_stack: list[str] = Field(default_factory=list)
    hiring_signals: list[str] = Field(default_factory=list)
    news_triggers: list[str] = Field(default_factory=list)

    full_name: str
    title: str
    email: str
    linkedin_url: str | None = None
    email_verified: bool = False

    # engagement signal, e.g. from a prior campaign or lead magnet interaction
    has_prior_engagement: bool = False
    campaign_id: uuid.UUID | None = None


class IngestionResult(BaseModel):
    status: str  # "ingested" | "skipped"
    reason: str | None = None
    lead_id: uuid.UUID


class CompanyOut(BaseModel):
    id: uuid.UUID
    domain: str
    name: str
    industry: str | None = None
    employee_count: int | None = None
    revenue_band: str | None = None
    funding_stage: str | None = None
    tech_stack: list[str] = Field(default_factory=list)
    source: str
    created_at: datetime


class LeadOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    company_id: uuid.UUID
    campaign_id: uuid.UUID | None = None
    full_name: str
    title: str | None = None
    email: str
    linkedin_url: str | None = None
    email_verified: bool
    stage: str
    do_not_contact: bool
    created_at: datetime
    updated_at: datetime


class LeadListItem(BaseModel):
    id: uuid.UUID
    full_name: str
    title: str | None = None
    email: str
    stage: str
    company_name: str
    company_domain: str
    created_at: datetime
    tier: str | None = None
    total_score: int | None = None


class ResearchBrief(BaseModel):
    summary: str
    personalization_angles: list[str]
    insufficient_signal: bool = False


class ScoreBreakdown(BaseModel):
    fit_score: int
    intent_score: int
    gap_score: int
    contactability_score: int
    engagement_score: int
    total_score: int
    tier: str  # "hot" | "warm" | "cool"


class OutreachDraft(BaseModel):
    subject: str
    body: str


class LeadResult(BaseModel):
    lead: LeadInput
    research: ResearchBrief
    score: ScoreBreakdown
    outreach: OutreachDraft | None = None
    prompt_version: str = "v1"


class OutreachMessageOut(BaseModel):
    id: uuid.UUID
    sequence_step: int
    subject: str
    body: str
    status: str
    sent_at: datetime | None = None
    opened_at: datetime | None = None
    replied_at: datetime | None = None
    bounced: bool
    prompt_version: str
    created_at: datetime


class LeadDetail(BaseModel):
    lead: LeadOut
    company: CompanyOut
    research: ResearchBrief | None = None
    score: ScoreBreakdown | None = None
    outreach: list[OutreachMessageOut] = Field(default_factory=list)

