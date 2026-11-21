-- 0002: canonical (trimmed, lowercase) lead emails.
--
-- Ingest now normalises emails, but rows stored earlier may be mixed-case, and
-- the unsubscribe webhook would miss them. This migration lowercases them and
-- adds a case-insensitive unique index so 'Jane@Acme.com' and 'jane@acme.com'
-- can never be two separate leads (one of them contactable after an opt-out).
--
-- Run once against an existing database:
--   psql "$DATABASE_URL" -f apps/api/db/migrations/0002_normalize_emails.sql

begin;

-- 1. Stop if two leads differ only by case. Merge them by hand first (keep the
--    one with do_not_contact = true if either has it), then re-run.
do $$
declare
  dup_count int;
begin
  select count(*) into dup_count from (
    select lower(trim(email)) from leads group by lower(trim(email)) having count(*) > 1
  ) d;
  if dup_count > 0 then
    raise exception '% email(s) exist in more than one case variant. Merge those leads before running this migration.', dup_count;
  end if;
end $$;

-- 2. Normalise existing rows
update leads set email = lower(trim(email)) where email <> lower(trim(email));

-- 3. Enforce it from now on
create unique index if not exists idx_leads_email_lower on leads (lower(email));

commit;
