# PRD — LeadForge
### AI-Powered Lead Generation & Outreach System for a Digital Marketing Agency

**Status:** Draft v1 | **Owner:** [you] | **Audience:** internal build reference + interview reviewers

> Naming note: "LeadForge" is a placeholder product name used consistently across all six documents so they read as one system. Rename freely.

---

## 1. Problem Statement

The agency needs a repeatable, mostly-automated way to generate **100 qualified B2B leads per month**, without a dedicated SDR team. Today this is either manual (slow, inconsistent) or fully outsourced (expensive, generic). LeadForge automates sourcing, enrichment, research, scoring, and first-touch outreach, while keeping a human in the loop for judgment calls (send approval, reply handling).

## 2. Goals

| Goal | Metric |
|---|---|
| Consistent lead volume | ≥100 net-new qualified leads/month |
| Reduce manual research time | <2 min human time per lead reaching outreach stage |
| Improve targeting precision | ≥60% of sourced leads score "Warm" or "Hot" |
| Drive pipeline | ≥8 booked calls/month from outbound |
| Keep cost per qualified lead low | <$15 fully loaded (tool cost / qualified lead) |

## 3. Non-Goals (v1)

- Not a multi-tenant SaaS (single agency, internal tool only — architecture will stay extensible for this later, see TRD §7).
- Not a full CRM replacement (Airtable/light Postgres pipeline view, not a HubSpot competitor).
- Not managing paid ad campaigns or SEO — outbound + AI research only. Social/content ideas are addressed as strategy (§9) not as a built feature in v1.
- No inbound form-to-lead handling in v1 (landing page offer exists as a marketing asset, but capturing/routing inbound form fills is a fast-follow, not MVP).

## 4. Target Users (internal)

| Persona | Needs |
|---|---|
| **Agency founder / Head of Growth** | Visibility into pipeline health, KPI dashboard, override scoring rules |
| **Account Executive / BD lead** | Reviews AI-drafted outreach before send, manages replies, books calls |
| **Marketing Ops (you)** | Configures ICP filters, integrations, prompt templates, monitors automation health |

## 5. Ideal Customer Profile (ICP) — what the system searches for

- **Company type:** B2B SaaS (Series A–C) and high-growth e-commerce/DTC brands
- **Size:** 20–200 employees, ~$2M–$50M revenue
- **Geography:** US-based (v1); English-language markets as fast-follow
- **Marketing maturity signal:** has a marketing function but no full team (e.g., 1 marketing manager, no CMO) — the classic "needs an agency" gap
- **Decision maker titles:** VP Marketing, Head of Growth, CMO, or Founder/CEO (for <30-person companies)
- **Trigger signals (raise priority):** recent funding round, hiring for growth/marketing roles, weak/slow website or thin ad presence detected during enrichment, recent leadership change in marketing

## 6. Core Features (MVP scope)

1. **Lead sourcing** — scheduled pulls from Apollo.io against saved ICP filters, deduped against existing DB.
2. **Enrichment** — Clay-driven waterfall enrichment (firmographics, tech stack, funding, hiring signals).
3. **AI research** — LLM call per lead/company that produces a structured research brief (pain points, recent triggers, personalization angles).
4. **Lead scoring** — deterministic + AI-assisted score (0–100), tiered Hot/Warm/Cool (see §8).
5. **Personalized outreach drafting** — LLM generates a cold email draft referencing the research brief; human approves/edits before send.
6. **Lightweight CRM/pipeline** — Postgres-backed dashboard (Kanban by stage: New → Researched → Outreach Sent → Replied → Booked → Won/Lost).
7. **Follow-up sequencing** — automated 3-touch cadence with stop-on-reply logic.
8. **Reporting** — KPI dashboard (§10).

## 7. Out of scope for MVP (backlog)

- Multi-channel outreach (LinkedIn DM automation) — legal/ToS risk, phase 3.
- A/B testing engine for subject lines/messaging.
- Inbound lead capture from the landing page/lead magnet (manual for now).
- Multi-tenant support.

## 8. Lead Scoring Method (simple, explainable)

Score = weighted sum, 0–100, computed by the FastAPI scoring service (see Backend Schema doc for storage):

| Factor | Weight | Example scoring logic |
|---|---|---|
| Firmographic fit (size, industry, revenue band match to ICP) | 30 | Exact ICP match = 30, adjacent = 15, poor fit = 0 |
| Intent/trigger signals (funding, hiring growth roles, leadership change) | 25 | Each confirmed signal = +8, capped at 25 |
| Marketing gap signal (no CMO, thin ad spend detected, dated website) | 20 | Strong gap evidence = 20, some = 10, none = 0 |
| Contactability (verified email, active LinkedIn, direct-dial found) | 15 | Verified work email + LinkedIn = 15, email only = 8 |
| Engagement (opened past email, visited site, downloaded lead magnet) | 10 | Any positive engagement = 10 |

**Tiers:** Hot ≥70 (same-day outreach), Warm 40–69 (standard cadence), Cool <40 (nurture only / excluded from active outreach).

The AI research step contributes qualitative *evidence* (e.g., "hiring 2 growth marketers, no senior marketing hire on LinkedIn") that a lightweight rules layer converts into the signal scores above — this keeps scoring explainable and auditable rather than a black-box LLM number.

## 9. Supporting Marketing Assets (content strategy, not built features)

- **Social ideas:**
  1. LinkedIn "teardown" series — short posts/carousels auditing a (anonymized or public) company's paid/website funnel, showcasing expertise to the exact ICP.
  2. Short-form video (Reels/Shorts) — "3 things wrong with [industry]'s Google Ads in 60 seconds," built for reach into founder/marketing-manager feeds.
- **Lead magnet:** "Marketing Audit Scorecard" — prospect submits their domain, gets an automated scored teardown (SEO, paid presence, site speed, competitor gap). This reuses the same enrichment/AI-research pipeline built for outbound — direct product/marketing synergy.
- **Landing page offer:** "Free 15-Minute Growth Audit Call" — low-commitment CTA, calendar embed, promises 3 specific quick-win findings on the call (not a generic "book a demo").

## 10. KPIs / Success Metrics

**Top-of-funnel**
- Leads sourced/month, enrichment success rate (%), AI research completion rate (%)

**Quality**
- Avg lead score, % Hot/Warm, contactability rate (valid email %)

**Outreach**
- Emails sent, open rate, reply rate, positive-reply rate, unsubscribe/spam-complaint rate (guardrail metric)

**Outcome**
- Meetings booked, meeting → opportunity rate, pipeline $ generated, cost per qualified lead, time-to-first-touch (lead sourced → outreach sent)

## 11. Constraints & Assumptions

- Single agency, internal use — no billing/tenant isolation needed in MVP.
- Tool budget assumption: Apollo (paid seat), Clay (credits-based), Airtable (free/plus tier), Claude/OpenAI API (usage-based), n8n (self-hosted, free) or n8n cloud starter.
- Compliance: CAN-SPAM / CASL adherence required for cold email (unsubscribe link, physical address, accurate headers) — see TRD §8.
- Human-in-the-loop is a deliberate design choice for send approval in MVP — full autonomy is a v2 consideration once trust in AI drafts is established.
