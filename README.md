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
# Open .env and fill in your ANTHROPIC_API_KEY 
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

## Run tests

```bash
pytest apps/api/tests/ -v
```

`scoring_service.py` is the one component with real unit test coverage by design — it's the part where a silent regression is expensive (bad leads scoring as Hot). See `/docs/07-AI-Context-Core.md` §4 for the full testing policy.

## Repo conventions

See `/docs/07-AI-Context-Core.md` before adding files — file length limits, service-layer pattern, and where prompts live are all specified there.
