-- 0001_init.sql
-- Initial schema per /docs/03-Backend-Schema.md
-- Apply in order. Never edit after merge — create a new migration file instead.

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  email text not null unique,
  name text,
  role text not null check (role in ('admin','ae','ops')),
  created_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  icp_filter jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  domain text not null unique,
  name text not null,
  industry text,
  employee_count int,
  revenue_band text,
  funding_stage text,
  tech_stack jsonb not null default '[]',
  source text not null default 'apollo',
  raw_enrichment jsonb,
  created_at timestamptz not null default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  company_id uuid not null references companies(id),
  campaign_id uuid references campaigns(id),
  full_name text not null,
  title text,
  email text not null unique,
  linkedin_url text,
  email_verified boolean not null default false,
  stage text not null default 'new'
    check (stage in ('new','enriched','researched','scored','outreach_drafted',
                      'outreach_sent','replied','booked','won','lost','unsubscribed')),
  do_not_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table enrichment_data (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references leads(id),
  seniority text,
  department text,
  hiring_signals jsonb not null default '[]',
  news_triggers jsonb not null default '[]',
  enriched_at timestamptz not null default now()
);

create table research_briefs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  summary text not null,
  personalization_angles jsonb not null default '[]',
  model_used text,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create table lead_scores (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  fit_score int not null,
  intent_score int not null,
  gap_score int not null,
  contactability_score int not null,
  engagement_score int not null,
  total_score int not null,
  tier text not null check (tier in ('hot','warm','cool')),
  scoring_version text not null default 'v1',
  created_at timestamptz not null default now()
);

create table outreach_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  sequence_step int not null default 1,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft','approved','sent','rejected')),
  approved_by uuid references users(id),
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  bounced boolean not null default false,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending','sent','skipped_replied','skipped_dnc'))
);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  actor text not null,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create table pipeline_errors (
  id uuid primary key default gen_random_uuid(),
  stage text not null,
  payload jsonb,
  error_message text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_leads_company on leads(company_id);
create index idx_leads_stage on leads(stage);
create index idx_leads_campaign on leads(campaign_id);
create index idx_lead_scores_lead_created on lead_scores(lead_id, created_at desc);
create index idx_outreach_lead_step on outreach_messages(lead_id, sequence_step);

-- Seed the single org for v1 (multi-tenant not active, see TRD §9)
insert into organizations (name) values ('Default Agency');
