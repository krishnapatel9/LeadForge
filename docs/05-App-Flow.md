# App Flow — LeadForge End-to-End Pipeline

## 1. Trigger

n8n scheduled workflow runs daily (configurable). Batch size capped by `MAX_LEADS_PER_RUN` (default 30) to control Clay credit and LLM spend.

## 2. Step-by-Step Flow

**Step 1 — Find Leads (Apollo)**
n8n calls Apollo.io search API using the active `campaign.icp_filter`. Results (name, title, company, LinkedIn, email if available) pass to FastAPI `POST /leads/ingest`.

**Step 2 — Dedupe**
FastAPI checks `companies.domain` and `leads.email` against Postgres. Existing records are skipped (or, if stale >90 days, flagged for re-enrichment instead of re-created). Only genuinely new leads continue.

**Step 3 — Enrich Data (Clay)**
n8n pushes new lead rows to a Clay table via webhook. Clay runs its enrichment waterfall (firmographics, tech stack, funding, hiring signals) and webhooks results back to n8n on completion.
- *Staging visibility:* n8n also writes the raw Clay output to an Airtable "QA" base at this point, so ops can spot-check enrichment quality without opening Postgres. This is read-only for humans — nothing downstream reads from Airtable.

**Step 4 — AI Research**
n8n POSTs enriched payload to FastAPI `POST /leads/{id}/research`. FastAPI calls the LLM with a versioned prompt (see AI Context Core) to produce: a summary of the company's likely marketing pain points, and 2-3 concrete personalization angles (e.g., "recently posted 3 open growth-marketing roles with no senior hire above them"). Stored in `research_briefs`.

**Step 5 — Lead Scoring**
FastAPI `POST /leads/{id}/score` runs the deterministic weighted formula (PRD §8) using enrichment + research brief evidence. Result stored in `lead_scores`; `leads.stage` advances to `scored`.
- If `tier = cool`: pipeline stops here for this lead (nurture list only, no outreach drafted) — this is the main cost/spam-risk control.

**Step 6 — Personalized Outreach Drafting**
For `warm`/`hot` leads, FastAPI `POST /leads/{id}/draft-outreach` calls the LLM with the research brief + a company/agency context block to generate subject + body. Stored in `outreach_messages` with `status = draft`; `leads.stage → outreach_drafted`.

**Step 7 — Human Approval**
Draft appears in the dashboard's "Needs Approval" queue. AE approves as-is, edits, or rejects. On approval, `status → approved`, `approved_by` set.

**Step 8 — Send (CRM/Email)**
n8n polls (or is webhook-triggered by) newly-approved messages, sends via Gmail/Outlook API (or Instantly.ai), sets `sent_at`, `leads.stage → outreach_sent`.

**Step 9 — Track & Follow Up**
Email provider webhooks (open/reply/bounce) update `outreach_messages`. A reply immediately halts the follow-up sequence (`follow_ups.status = skipped_replied`) and advances `leads.stage → replied`, surfacing it for manual handling. No reply after 3–4 days triggers `follow_up` step 2 (auto-generated short bump, not a full re-draft), then step 3 after another gap. No reply after step 3 → lead marked `lost` (nurture-eligible) automatically.

**Step 10 — CRM/Pipeline Update**
Every transition above writes an `activity_log` row and updates the Kanban board in real time (dashboard polls or subscribes to Postgres changes).

**Step 11 — Reporting Rollup**
A scheduled job (nightly) aggregates counts/rates into materialized values the Reports screen reads, keeping the dashboard fast without heavy on-the-fly aggregation.

## 3. Error Handling

Every step writes to `pipeline_errors` on failure (bad payload, API timeout, LLM error) rather than silently dropping the lead. n8n retries 3x with backoff before logging. The Settings screen surfaces unresolved errors so nothing gets permanently stuck without visibility.

## 4. Decision Points Summary

| Point | Condition | Outcome |
|---|---|---|
| After dedupe | Lead already exists, <90 days old | Skip |
| After scoring | Tier = Cool | Stop (no outreach drafted) |
| After send | Reply received | Halt follow-ups, route to AE |
| After 3 follow-ups | No reply | Mark Lost, eligible for nurture list |
| Any step | do_not_contact = true | Hard stop, never re-enters pipeline |
