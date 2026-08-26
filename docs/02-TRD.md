# TRD — LeadForge Technical Requirements

## 1. Architecture Overview

```
Apollo.io ──▶ n8n (orchestrator) ──▶ Clay (enrichment) ──▶ FastAPI service ──▶ Postgres ◀──▶ Next.js dashboard
                    │                                        │  (AI research, scoring,
                    │                                        │   outreach generation via
                    ▼                                        │   Claude/OpenAI API)
                Airtable                                     ▼
             (staging/QA view,                        Email send/track
              non-technical                          (n8n + Gmail/Outlook API
              spot-checking)                           or Instantly.ai)
```

**Design principle:** n8n owns *scheduling and glue* (calling APIs in sequence, retries, staging). The FastAPI service owns anything that needs custom logic, prompt control, or must be unit-tested (AI calls, scoring formula, dedupe logic). Postgres is the single source of truth for the product; Airtable is a **non-authoritative staging/QA layer** the ops person can eyeball mid-pipeline — it is not read by the dashboard.

## 2. Components

| Component | Responsibility | Tech |
|---|---|---|
| Orchestration layer | Scheduled triggers, calling Apollo/Clay, sequencing steps, retry/backoff, routing to FastAPI | n8n (self-hosted via Docker) |
| Sourcing | Pull leads matching saved ICP search | Apollo.io API |
| Enrichment | Waterfall enrichment (firmographic, tech stack, funding, hiring signals) | Clay |
| Staging/QA | Human-visible mid-pipeline snapshot | Airtable API |
| AI/Scoring service | Research brief generation, deterministic scoring, outreach drafting, dedupe logic | FastAPI (Python) |
| LLM provider | Research synthesis, personalization, drafting | Claude API (primary), OpenAI as fallback |
| Database | System of record for leads, companies, scores, outreach, campaigns | Postgres |
| Dashboard | Pipeline view, lead detail, approval UI, KPI reporting, settings | Next.js (React) + Tailwind |
| Email send/track | Outbound send, open/reply/bounce webhooks | n8n + Gmail/Outlook API, or Instantly.ai if deliverability at scale becomes an issue |
| Auth | Internal team login | NextAuth (email/password or Google SSO) — single org, no multi-tenant auth complexity needed yet |

## 3. Data Flow (summary — full detail in App Flow doc)

1. n8n triggers on schedule (e.g., daily, batch of ~30–50 leads to stay within API/LLM budget).
2. Apollo search executes against saved filter; results POSTed to FastAPI `/leads/ingest`.
3. FastAPI dedupes against Postgres (by domain + email hash) before continuing.
4. New leads sent to Clay for enrichment; Clay webhooks results back to n8n.
5. n8n POSTs enriched payload to FastAPI `/leads/{id}/research` → LLM call → structured research brief stored.
6. FastAPI `/leads/{id}/score` computes deterministic score using research brief + enrichment fields.
7. If score ≥ Warm threshold: FastAPI `/leads/{id}/draft-outreach` generates email draft.
8. Draft surfaces in dashboard "Needs Approval" queue. On approval, n8n sends via email API.
9. Reply/open webhooks update lead stage; follow-up cadence continues until reply or 3 touches.

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Batch processing acceptable (not real-time). End-to-end lead → outreach-ready target: <10 min/lead including LLM calls. |
| **Reliability** | Every n8n workflow step must have retry (3x, exponential backoff) and dead-letter logging to a Postgres `pipeline_errors` table. |
| **Security** | All API keys in n8n credential store / FastAPI env vars, never in workflow JSON or repo. Postgres access via least-privilege service role for FastAPI. |
| **Compliance** | CAN-SPAM: every outbound email includes unsubscribe link + physical address; unsubscribes hard-block future sends at the DB level (`leads.do_not_contact`). |
| **PII handling** | Store only business-context PII (work email, name, title, company). No personal/home data. Data retention policy: purge leads with `Lost`/`Unsubscribed` status after 12 months of inactivity. |
| **Observability** | n8n execution logs retained 30 days; FastAPI structured logging (JSON) to stdout, captured by hosting platform; a `system_health` widget on the dashboard shows last successful run per pipeline stage. |
| **Scalability** | MVP target: ~150–200 leads/month processed. Architecture (stateless FastAPI, Postgres, queue-friendly n8n) supports 10x without redesign. Multi-tenant would require adding an `org_id` scoping layer — schema already anticipates this (see Backend Schema doc). |
| **Cost control** | LLM calls batched and capped per run (config value `MAX_LEADS_PER_RUN`); Clay enrichment gated behind a pre-filter in Apollo query to avoid wasting credits on obviously poor-fit leads. |

## 5. External Integrations

| Service | Auth method | Direction | Notes |
|---|---|---|---|
| Apollo.io | API key | Pull (search + person/org enrichment) | Rate-limited; respect their bulk export limits |
| Clay | Webhook + API key | Push (send rows) / Pull (webhook receives results) | Credit-metered — monitor usage |
| Airtable | Personal access token | Push (staging writes only) | Non-authoritative, no reads by app |
| Claude/OpenAI API | API key | Request/response | System prompts version-controlled (see AI Context Core doc) |
| Email provider (Gmail/Outlook API or Instantly) | OAuth2 or API key | Send + webhook (opens/replies/bounces) | Deliverability warm-up required before scale |
| Postgres | Connection string | Internal | Hosted (e.g., Supabase/Railway/RDS) |

## 6. Environments

- **dev** — local Docker Compose (Postgres, n8n, FastAPI), test Apollo/Clay sandbox credits, LLM calls capped/mocked where possible.
- **staging** — mirrors prod, used to validate new prompt versions or scoring weight changes before rollout.
- **prod** — live agency use.

## 7. Deployment (suggested, not mandated)

- Frontend (Next.js): Vercel.
- FastAPI service: Railway or Fly.io (simple container deploy, autoscale not needed at this volume).
- Postgres: Supabase or Railway managed Postgres (get a UI/inspector for free).
- n8n: self-hosted on the same Railway/Fly project or n8n Cloud starter tier if the team prefers not to manage infra.

## 8. Compliance Notes

- CAN-SPAM (US) and CASL (if contacting Canadian companies) both require: accurate sender info, no misleading subject lines, working unsubscribe, honored within 10 business days. Build unsubscribe handling in v1, not as a fast-follow — this is a legal requirement, not a nice-to-have.
- Apollo/Clay data usage must comply with their respective terms of service for outbound use — review before scaling volume.

## 9. Multi-Tenant Readiness (documented, not built)

Every core table carries an `org_id` foreign key from day one (see Backend Schema), defaulted to a single seeded org row. This costs nothing now and avoids a painful migration if the tool is ever offered to other agencies.
