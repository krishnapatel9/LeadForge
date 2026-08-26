# LeadForge

AI-powered lead generation & outreach system for a digital marketing agency.
Full planning docs in `/docs`. This repo currently contains the **Phase 1 POC**
(see `/docs/06-Implementation-Plan.md`) — one FastAPI endpoint proving the
find → research → score → draft loop, writing results to a local CSV.

## What's here vs. what's next

| Done (this scaffold) | Not yet built |
|---|---|
| `POST /poc/process-lead` — research + score + draft in one call | Postgres persistence (schema is ready in `db/migrations/`, just not wired up) |
| Deterministic scoring (`services/scoring_service.py`) + unit tests | Apollo/Clay live integration (guide in `workflows/poc_pipeline_guide.md`) |
| Versioned AI prompts (`prompts/*.md`) via central `ai_client.py` | Dashboard (Phase 2/3, see Implementation Plan) |
| CSV output sink | Email send + follow-up automation |

## Setup

```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in ANTHROPIC_API_KEY at minimum
```

## Run the POC API

```bash
uvicorn apps.api.main:app --reload --app-dir ../..   # run from repo root, or adjust PYTHONPATH
```

Then either:
- Follow `workflows/poc_pipeline_guide.md` to wire it into n8n, or
- `curl` it directly (example payload in that same guide) to validate the loop
  before touching n8n/Apollo/Clay at all.

Results append to `poc_results.csv` at the repo root.

## Run tests

```bash
pytest apps/api/tests/ -v
```

`scoring_service.py` is the one component with real unit test coverage by
design — it's the part where a silent regression is expensive (bad leads
scoring as Hot). See `/docs/07-AI-Context-Core.md` §4 for the full testing
policy.

## Moving to Phase 2

1. Stand up Postgres (Supabase is fastest), run `apps/api/db/migrations/0001_init.sql`.
2. Split `routers/poc.py` into the real `/leads/ingest`, `/leads/{id}/research`,
   `/leads/{id}/score`, `/leads/{id}/draft-outreach` endpoints per
   `/docs/02-TRD.md` §3, each persisting to Postgres instead of returning
   directly.
3. Wire the n8n workflow to call those endpoints in sequence instead of the
   single POC endpoint.
4. Start the Next.js dashboard (`/docs/04-UIUX-Design.md`) against the same DB.

## Repo conventions

See `/docs/07-AI-Context-Core.md` before adding files — file length limits,
service-layer pattern, and where prompts live are all specified there.
