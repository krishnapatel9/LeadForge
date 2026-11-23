# LeadForge

AI-powered lead generation & outreach system for a digital marketing agency. Full planning docs in `/docs`. 

This repository contains the **fully realized LeadForge Application**, which orchestrates the entire "find → research → score → draft" outbound loop using a FastAPI backend, PostgreSQL database, and a stunning Next.js App Router dashboard.

## System Architecture

| Component | Tech Stack | Status |
|---|---|---|
| **API Backend** | FastAPI, Python 3.12+, SQLAlchemy (async) | Pipeline (ingest → research → score → draft → approve/send), campaigns, reports, health |
| **Database** | PostgreSQL (Neon in production) | Migrations in `apps/api/db/migrations`, applied by `python -m apps.api.scripts.migrate` |
| **Dashboard UI** | Next.js 14 | Implements the monochrome prototype: Pipeline, Approvals, Campaigns, Performance, Integrations, Help |
| **Hosting** | Vercel, Render, Neon, Cloudflare | All free tiers, no Docker (see [DEPLOY.md](DEPLOY.md)) |
| **Automation** | Apollo / Clay / n8n | Push leads to `POST /leads/ingest` with the service key |

### Lead pipeline

Each lead moves through one state machine (`apps/api/services/lead_state.py`). A step only runs
from the stages listed below; anything else returns `409`, and an opted-out lead returns `400`.

| Step | Allowed from | Leaves the lead in |
|---|---|---|
| Research (`POST /leads/{id}/research`) | new, enriched, researched, scored | researched |
| Score (`POST /leads/{id}/score`) | researched, scored | scored |
| Draft (`POST /leads/{id}/draft-outreach`) | scored, outreach_drafted | outreach_drafted |
| Approve (`POST /leads/{id}/outreach/approve`) | outreach_drafted | outreach_sent (email sent) |
| Reject (`POST /leads/{id}/outreach/reject`) | outreach_drafted | scored |

If the research brief flags `insufficient_signal`, drafting is refused (`422`). AI or email failures
return `502` and are recorded in `pipeline_errors` (shown on the Integrations page).

## Setup & Running the Application

### 1. Environment

```bash
cp apps/api/.env.example apps/api/.env
# Fill in GEMINI_API_KEY, JWT_SECRET, SERVICE_API_KEY and (to really send) SMTP_*
```

Without `SMTP_USERNAME`/`SMTP_PASSWORD`, approved emails are logged by the API instead of sent.

### 2. Database

Any PostgreSQL 14+ works. The simplest is a free Neon project (or a separate Neon *branch* of your
production database, so local work never touches live data). Put its connection string in
`DATABASE_URL` in `apps/api/.env` exactly as Neon gives it; the API converts it for its driver.

Then create the tables (safe to run again; it only applies new migrations):

```bash
python -m apps.api.scripts.migrate
```

### 3. Run the API

Run from the repo root so `apps.api` imports resolve. Settings come from `apps/api/.env`
(a `.env` in the current directory, or real environment variables, override it):

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r apps/api/requirements.txt
uvicorn apps.api.main:app --reload --port 8000
```

Optional demo data (14 synthetic leads at every stage, `.example` domains only):

```bash
python -m apps.api.scripts.seed_demo          # --reset to recreate, --remove to delete
```

### 4. Dashboard

`cd apps/dashboard`, `npm install`, `npm run dev -- -p 3001`, then open **http://localhost:3001** and sign in (see below). Set `NEXT_PUBLIC_API_BASE` to the API's URL
when the API isn't on `http://localhost:8000`.

### 5. Hosting (free)

See **[DEPLOY.md](DEPLOY.md)**: the dashboard on Vercel (Root Directory `apps/dashboard`), the API on
Render's free plan (`render.yaml`), Postgres on Neon, and a Cloudflare cron Worker
(`infrastructure/cloudflare/keepalive`) that pings the API every 10 minutes so it doesn't sleep.
The API applies new migrations on every start (`python -m apps.api.scripts.migrate`), and
`BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` create the first login on a fresh database.

## Authentication

Every API route except `/health`, `/auth/login` and the signed unsubscribe link needs a signed-in user or the automation key.

**First-time setup**

```bash
# 1. Create the tables: python -m apps.api.scripts.migrate

# 2. Set secrets in apps/api/.env (see .env.example)
#    JWT_SECRET is required when ENVIRONMENT is not "development"
python -c "import secrets; print(secrets.token_urlsafe(48))"

# 3. Create users (the password is prompted for, never passed as an argument)
python -m apps.api.scripts.create_user --email you@agency.com --role admin --name "Your Name"
```

There are no default accounts. Running the same command for an existing email resets its password.

**Roles**

| Role | Can do |
|---|---|
| `admin` | Everything, including the POC endpoint and campaign profiles |
| `ae` | View leads, run research/score/draft, **approve or reject outreach** |
| `ops` | View leads, ingest, run research/score/draft, manage campaign profiles. Cannot approve outreach |
| Service key (`X-API-Key: $SERVICE_API_KEY`) | Ingest, research, score, draft (for n8n). Cannot approve outreach or read the dashboard API |

**How it works**

- `POST /auth/login` returns a JWT access token (HS256, `JWT_EXPIRE_MINUTES`, default 8 hours). Passwords are hashed with scrypt. Failed logins are throttled to 5 per email and IP per 15 minutes.
- Every request re-reads the user, so disabling an account (`is_active = false`) or changing a role takes effect at once.
- Users only see leads from their own organisation.
- Approvals record the real approver (`outreach_messages.approved_by` and `activity_log.actor`).
- Each outreach email gets a postal address, a signed unsubscribe link (`/webhooks/unsubscribe?email=…&token=…`) and RFC 8058 `List-Unsubscribe` / `List-Unsubscribe-Post` headers, so mail clients' one-click unsubscribe works. The token only works for the address it was issued for, so nobody can unsubscribe other people. Email providers can call the same webhook with the service key instead. Unsubscribing also cancels any pending draft.
- The dashboard keeps the token in `sessionStorage` (per tab, cleared when the tab closes) and signs out on any 401. Moving to an httpOnly cookie needs the API and dashboard served from the same site.

## Run tests

```bash
pytest apps/api/tests/ -v
```

These need no database. The end-to-end test in `test_api_integration.py` writes real rows, so it is
skipped unless `RUN_DB_TESTS=1` is set, with `DATABASE_URL` pointing at a throwaway database
(never the live one) that has had `python -m apps.api.scripts.migrate` run on it.

`scoring_service.py` is the one component with real unit test coverage by design — it's the part where a silent regression is expensive (bad leads scoring as Hot). See `/docs/07-AI-Context-Core.md` §4 for the full testing policy.

## Repo conventions

See `/docs/07-AI-Context-Core.md` before adding files — file length limits, service-layer pattern, and where prompts live are all specified there.
