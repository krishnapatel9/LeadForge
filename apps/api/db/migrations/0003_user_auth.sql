-- 0003: sign-in for dashboard users.
--
-- Adds a password hash (scrypt, set by the create_user CLI), an active flag for
-- disabling accounts, and the last sign-in time. Existing users get no password
-- and cannot sign in until one is set with:
--   python -m apps.api.scripts.create_user --email you@agency.com --role ae
--
-- Run once:
--   psql "$DATABASE_URL" -f apps/api/db/migrations/0003_user_auth.sql

begin;

alter table users add column if not exists password_hash text;
alter table users add column if not exists is_active boolean not null default true;
alter table users add column if not exists last_login_at timestamptz;

-- The old approve endpoint auto-created this placeholder account. It has no
-- password, so it can't sign in; disable it so it never looks like a real user.
update users set is_active = false where email = 'ae@agency.com' and password_hash is null;

-- Emails are matched case-insensitively at sign-in
create unique index if not exists idx_users_email_lower on users (lower(email));

commit;
