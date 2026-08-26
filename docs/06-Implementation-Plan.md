# Implementation Plan — LeadForge

## Phase 0 — Planning (this document set)
Deliverables: PRD, TRD, Backend Schema, UI/UX Design, App Flow, AI Context Core. ✅

## Phase 1 — Bonus/Proof-of-Concept (target: the 5-6hr task window)
Goal: prove the core loop works end-to-end with minimal build cost.
- n8n workflow: Apollo search (manual trigger, small batch) → Clay enrichment → single FastAPI endpoint that does research + scoring + outreach draft in one call (simplify vs. the 3 separate endpoints in TRD, for speed) → write result row to Google Sheets or Airtable.
- No dashboard yet — Airtable/Sheets *is* the interface at this stage.
- No auth, no follow-up automation, no email sending — draft generation only.
- Success criterion: one real lead flows through find → research → score → draft, end to end, unattended.

## Phase 2 — MVP Core (weeks 1-3 post-POC)
- Stand up Postgres schema (Backend Schema doc) and FastAPI service with the three real endpoints (`/research`, `/score`, `/draft-outreach`) plus `/leads/ingest`.
- Migrate n8n workflow to call FastAPI instead of writing to Sheets directly.
- Build minimal Next.js dashboard: Pipeline (Kanban) + Lead Detail + Needs Approval queue. Reports and Campaigns UI deferred.
- Wire real email send (start with Gmail API for lowest setup friction) + unsubscribe handling (legal requirement, not optional — build alongside send, not after).
- Success criterion: full pipeline running on a schedule, AE approving/sending from the dashboard daily.

## Phase 3 — Follow-ups, Reporting, Polish (weeks 4-6)
- Follow-up sequencing (`follow_ups` table + n8n scheduled job).
- Reports screen + nightly rollup job.
- Campaigns UI (edit ICP filters without touching Apollo directly).
- Settings screen: integration health, prompt version visibility.
- Error visibility (`pipeline_errors` surfaced in UI).

## Phase 4 — Hardening & Optional Expansion (ongoing)
- Prompt iteration based on reply-rate data (A/B test subject lines/angles).
- Consider LinkedIn outreach channel (review ToS/legal risk first).
- Consider inbound capture from the lead magnet/landing page feeding the same `leads` table (`source = inbound`).
- Multi-tenant activation, if ever offered to other agencies — schema already supports it (org_id everywhere); mainly an auth/billing layer addition.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Apollo/Clay data quality varies by industry | Start with one ICP segment, validate score/reply correlation before expanding filters |
| LLM cost creep at scale | Hard batch cap (`MAX_LEADS_PER_RUN`), Cool-tier leads never reach the (most expensive) outreach-drafting call |
| Deliverability/spam flags | Start on a warmed sending domain, enforce unsubscribe + low daily volume ramp-up, monitor bounce/complaint rate as a guardrail KPI |
| AI drafts feel generic despite personalization angles | Human approval step in v1 catches this; treat prompt quality as an ongoing tuning task, not a one-time build item |
| Single point of failure (you) maintaining n8n/FastAPI | Document runbooks in the repo README; keep workflows simple enough for a non-builder to restart a stuck run |

## Rough Cost Estimate (monthly, at ~150 leads processed)

| Item | Est. cost |
|---|---|
| Apollo seat | $49-99 |
| Clay credits | $50-150 depending on enrichment depth |
| Claude/OpenAI API | $20-60 at this volume |
| Hosting (Vercel + Railway/Supabase) | $0-40 (free tiers likely cover MVP) |
| n8n (self-hosted) | $0, or ~$20 n8n Cloud starter |
| **Total** | **~$150-350/month** |
