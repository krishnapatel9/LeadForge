-- 0004: pipeline state fixes.
--
-- * research_briefs.insufficient_signal: the AI's "too little data to personalise"
--   flag is now stored, so drafting can refuse and the dashboard can show it.
-- * companies.enriched_at: company staleness is measured from the last refresh,
--   not created_at (which never changes, so every company went stale at 90 days).
--
-- Run once:
--   psql "$DATABASE_URL" -f apps/api/db/migrations/0004_pipeline.sql

begin;

alter table research_briefs add column if not exists insufficient_signal boolean not null default false;

alter table companies add column if not exists enriched_at timestamptz;
update companies set enriched_at = created_at where enriched_at is null;
alter table companies alter column enriched_at set not null;
alter table companies alter column enriched_at set default now();

create index if not exists idx_research_briefs_lead_created on research_briefs(lead_id, created_at desc);
create index if not exists idx_leads_org_created on leads(org_id, created_at desc);

commit;
