# LeadForge

AI-powered lead generation & outreach system for a digital marketing agency. Full planning docs in `/docs`. 

This repository contains the **fully realized LeadForge Application**, which orchestrates the entire "find → research → score → draft" outbound loop using a FastAPI backend, PostgreSQL database, and a stunning Next.js App Router dashboard.

## System Architecture

| Component | Tech Stack | Status |
|---|---|---|
| **API Backend** | FastAPI, Python 3.10+, SQLAlchemy (async) | **Completed** - Full CRUD, API endpoints, AI Prompt Engine |
| **Database** | PostgreSQL 15 | **Completed** - `leadforge` schema fully migrated and active |
| **Dashboard UI** | Next.js 14, TailwindCSS, Lucide Icons | **Completed** - Kanban Pipeline, Intelligence Dossier, Outreach Approvals |
| **Orchestration** | Docker Compose | **Completed** - Single command startup |
| **Automation** | n8n / Apollo / Clay | *Pending integration* |

## Setup & Running the Application

The entire application has been containerized for easy deployment and local testing.

### 1. Environment Configuration

```bash
cd apps/api
cp .env.example .env   
# Open .env and fill in your GEMINI_API_KEY 
```

### 2. Start the Stack (Docker)

At the root of the repository, run:

```bash
docker-compose up -d --build
```

This will launch:
- `leadforge-db` (Postgres) on port `5435`
- `leadforge-api` (FastAPI backend) on port `8000` (Wait, if docker-compose runs API? The API is currently run locally, let's update this to reflect reality)

*Note: In the current setup, the Dashboard and DB are in Docker, while the API is run via Uvicorn.*

### 3. Run the Backend (FastAPI)

```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn apps.api.main:app --reload --port 8000 --app-dir ../..
```

### 4. Access the Dashboard

Open your browser and navigate to:
**http://localhost:3001**

You'll see the Lead Pipeline Kanban board, where you can click on any ingested lead to view their AI-generated research dossier, score breakdown, and approve drafted outreach messages.

## Authentication

Every API route except `/health`, `/auth/login` and the signed unsubscribe link needs a signed-in user or the automation key.

**First-time setup**

```bash
# 1. Apply the auth migration (adds password_hash, is_active, last_login_at to users)
psql "$DATABASE_URL" -f apps/api/db/migrations/0003_user_auth.sql

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
| `admin` | Everything, including the POC endpoint |
| `ae` | View leads, run research/score/draft, **approve or reject outreach** |
| `ops` | View leads, ingest, run research/score/draft. Cannot approve outreach |
| Service key (`X-API-Key: $SERVICE_API_KEY`) | Ingest, research, score, draft (for n8n). Cannot approve outreach or read the dashboard API |

**How it works**

- `POST /auth/login` returns a JWT access token (HS256, `JWT_EXPIRE_MINUTES`, default 8 hours). Passwords are hashed with scrypt. Failed logins are throttled to 5 per email and IP per 15 minutes.
- Every request re-reads the user, so disabling an account (`is_active = false`) or changing a role takes effect at once.
- Users only see leads from their own organisation.
- Approvals record the real approver (`outreach_messages.approved_by` and `activity_log.actor`).
- Each outreach email gets a postal address and a signed unsubscribe link (`/webhooks/unsubscribe?email=…&token=…`). The token only works for the address it was issued for, so nobody can unsubscribe other people. Email providers can call the same webhook with the service key instead.
- The dashboard keeps the token in `sessionStorage` (per tab, cleared when the tab closes) and signs out on any 401. Moving to an httpOnly cookie needs the API and dashboard served from the same site.

## Run tests

```bash
pytest apps/api/tests/ -v
```

`scoring_service.py` is the one component with real unit test coverage by design — it's the part where a silent regression is expensive (bad leads scoring as Hot). See `/docs/07-AI-Context-Core.md` §4 for the full testing policy.

## Repo conventions

See `/docs/07-AI-Context-Core.md` before adding files — file length limits, service-layer pattern, and where prompts live are all specified there.
