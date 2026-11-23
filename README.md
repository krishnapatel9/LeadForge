# LeadForge

AI-powered lead generation & outreach system for a digital marketing agency. Full planning docs in `/docs`. 

This repository contains the **fully realized LeadForge Application**, which orchestrates the entire "find → research → score → draft" outbound loop using a FastAPI backend, PostgreSQL database, and a stunning Next.js App Router dashboard.

## System Architecture

| Component | Tech Stack | Status |
|---|---|---|
| **API Backend** | FastAPI, Python 3.12+, SQLAlchemy (async) | Pipeline (ingest → research → score → draft → approve/send), campaigns, reports, health |
| **Database** | PostgreSQL 15 | Migrations in `apps/api/db/migrations`, applied automatically on a fresh Docker volume |
| **Dashboard UI** | Next.js 14 | Implements the monochrome prototype: Pipeline, Approvals, Campaigns, Performance, Integrations, Help |
| **Orchestration** | Docker Compose | `db`, `api` and `dashboard` services |
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

### 2. Start everything with Docker

```bash
docker compose up -d --build
```

- `leadforge-db` (Postgres) on port `5435`. On first start it applies every file in `apps/api/db/migrations`.
- `leadforge-api` (FastAPI) on port `8000`
- `leadforge-dashboard` (Next.js) on port `3001`

Existing database? Apply new migrations by hand, in order, for example:

```bash
psql "postgresql://leadforge:password123@localhost:5435/leadforge" -f apps/api/db/migrations/0004_pipeline.sql
```

### 3. Or run the API locally

Run from the repo root so `apps.api` imports resolve. Settings come from `apps/api/.env`
(a `.env` in the current directory, or real environment variables, override it):

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r apps/api/requirements.txt
uvicorn apps.api.main:app --reload --port 8000
```

### 4. Dashboard

Open **http://localhost:3001** and sign in (see below). Set `NEXT_PUBLIC_API_BASE` to the API's URL
when the API isn't on `http://localhost:8000`.

**Vercel:** set the project's Root Directory to `apps/dashboard` (it uses `apps/dashboard/vercel.json`)
and set `NEXT_PUBLIC_API_BASE` and `NEXT_PUBLIC_SITE_URL` in the project's environment variables.
Add the dashboard's URL to the API's `CORS_ORIGINS`.

## Authentication

Every API route except `/health`, `/auth/login` and the signed unsubscribe link needs a signed-in user or the automation key.

**First-time setup**

```bash
# 1. Migrations are applied automatically on a fresh Docker database (see above)

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

`scoring_service.py` is the one component with real unit test coverage by design — it's the part where a silent regression is expensive (bad leads scoring as Hot). See `/docs/07-AI-Context-Core.md` §4 for the full testing policy.

## Repo conventions

See `/docs/07-AI-Context-Core.md` before adding files — file length limits, service-layer pattern, and where prompts live are all specified there.
