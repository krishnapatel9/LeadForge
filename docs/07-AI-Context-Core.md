# AI Context Core — LeadForge

Purpose: drop this into the repo root (e.g. as `CLAUDE.md` / `.cursorrules` / equivalent) so any AI coding assistant building this system produces consistent, maintainable code. This is a *build-time* engineering guide — distinct from the AI *product* prompts in §5, which govern what LeadForge itself says to leads.

## 1. Repo Structure

```
/apps
  /dashboard        (Next.js)
  /api               (FastAPI)
/workflows           (exported n8n JSON, version-controlled)
/db
  /migrations        (SQL, sequential, never edited after merge)
/docs                (this document set)
```

## 2. File Length & Structure Limits

- **Python:** max ~300 lines per file. If a FastAPI router file grows past that, split by resource (e.g. `leads_router.py`, `scoring_router.py`) not by arbitrary line count.
- **React/TSX:** max ~250 lines per component. Extract subcomponents once a file mixes more than ~2 concerns (e.g. a Kanban column that also owns modal logic → split the modal out).
- **No god files.** `utils.py` / `helpers.ts` catch-alls are not allowed — utilities live next to the domain they serve (`scoring/utils.py`, not a global dumping ground).
- One exported component/class per file where practical; co-locate small private helpers only.

## 3. Code Style & Restrictions

**Python (FastAPI service)**
- Type hints required on all function signatures — no bare `def foo(x):`.
- Pydantic models for every request/response body — no raw dicts crossing an API boundary.
- All LLM calls go through a single `ai_client.py` wrapper (never called ad hoc from route handlers) — this is where retries, logging, and prompt-version tagging live centrally.
- No business logic in route handlers — handlers call a service function (`scoring_service.py`, `research_service.py`); handlers only validate input and shape output.
- Formatting: `black` + `ruff`, enforced pre-commit.

**TypeScript/React (dashboard)**
- Functional components + hooks only, no class components.
- Server state (leads, scores) via a data-fetching layer (e.g. React Query/SWR) — never `useEffect` + manual fetch for anything hitting the API.
- Tailwind utility classes only — no ad hoc inline styles, no new CSS files per component.
- Strict TypeScript (`strict: true`); no `any` without an inline comment justifying it.

**Database**
- All schema changes via sequential migration files, never manual `ALTER` in prod.
- No destructive migrations without a corresponding backfill/rollback plan noted in the migration file's header comment.

**General restrictions**
- No secrets in code or workflow JSON, ever — env vars only, referenced by name.
- No direct Postgres writes from n8n — always through FastAPI (TRD §1 design principle). This is a hard rule, not a preference, because it's the only way scoring/dedupe logic stays in one place.
- Every new external API integration gets a thin client wrapper (e.g. `apollo_client.py`) — never inline `requests.get()` calls scattered through the codebase.

## 4. Testing Expectations

- Scoring logic (`scoring_service.py`) requires unit tests for each weighted factor — this is the one component where a silent regression would be expensive (bad leads getting Hot scores).
- API endpoints: integration tests against a test Postgres instance (not mocked DB) for at least the happy path + dedupe path.
- LLM-calling code: test the *parsing/handling* of responses (mock the LLM call itself) — don't assert on exact LLM output text.

## 5. Product AI Prompts (what LeadForge says to leads/about leads)

These are versioned separately from the codebase's general style rules above, because they're a product surface, not infrastructure.

- **Location:** `/apps/api/prompts/`, one file per prompt (`research_brief_v1.md`, `outreach_draft_v1.md`), plain text/markdown, not embedded as string literals in Python — keeps them diffable and reviewable independent of code changes.
- **Versioning:** every prompt file is immutable once used in production; a change creates `_v2`, and `research_briefs.prompt_version` / `outreach_messages.prompt_version` record which one generated a given record. This is what makes reply-rate-by-prompt-version analysis possible later (Implementation Plan Phase 4).
- **Tone constraints for outreach drafts:** no fabricated claims about the lead's company (only reference facts present in the research brief/enrichment data — the model must not invent statistics or news), no false urgency ("act now"), no generic templated openers ("I hope this finds you well"), max ~120 words for a first-touch email.
- **Guardrails:** the outreach-drafting prompt explicitly instructs the model to flag (rather than draft around) any lead where the research brief is too thin for genuine personalization — better to surface "insufficient signal" to the human than force a generic-feeling email.

## 6. What an AI assistant working on this repo should always do

1. Read the relevant doc in `/docs` before touching a component it governs (e.g. don't change the scoring weights without checking PRD §8 first).
2. Prefer extending the existing service-layer pattern over introducing a new one.
3. Flag — don't silently work around — any place where a change would require a Postgres migration.
4. Never add a new external dependency without noting it in TRD §5 (integrations table) so the doc set stays in sync with reality.
