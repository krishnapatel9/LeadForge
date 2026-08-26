# UI/UX Design — LeadForge Dashboard

## 1. Design Principles

- **Dense but scannable** — this is an internal ops tool for a small team, not a consumer product. Prioritize information density over whitespace-heavy marketing aesthetics.
- **Trust the AI, verify the AI** — every AI-generated field (research brief, score, outreach draft) is visibly labeled and editable. Nothing sends without a human glance in v1.
- **One primary action per screen** — the pipeline view's job is triage; the lead detail view's job is approve-or-edit; the reports view's job is glanceable KPIs. Avoid overloading any single screen.

## 2. Navigation Structure

```
Sidebar:
 ├─ Pipeline (default view)
 ├─ Needs Approval  ← badge count
 ├─ Campaigns
 ├─ Reports
 └─ Settings (integrations, ICP filters, prompt versions)
```

## 3. Key Screens

### 3.1 Pipeline (Kanban)
Columns = lead `stage` (New → Enriched → Researched → Scored → Outreach Drafted → Sent → Replied → Booked → Won/Lost).
- Each card: name, title @ company, score badge (color-coded Hot/Warm/Cool), days in stage.
- Filter bar: campaign, score tier, date range.
- Click card → Lead Detail view (slide-over panel, not full navigation, to keep pipeline context).

### 3.2 Lead Detail (slide-over)
Sections, top to bottom:
1. **Header** — name, title, company, score badge, stage dropdown (manual override allowed).
2. **Enrichment summary** — firmographic facts as compact chips (industry, size, revenue band, tech stack).
3. **AI Research Brief** — summary + personalization angles, labeled "AI-generated" with model/prompt version footnote.
4. **Score breakdown** — the 5 weighted factors as a small horizontal bar chart, not just the total number, so the AE can see *why* it scored the way it did.
5. **Outreach draft** — editable text area (subject + body), "Approve & Send" / "Edit" / "Reject" actions.
6. **Activity timeline** — chronological log (system + human actions).

### 3.3 Needs Approval (queue)
A flat, high-throughput list — the single most important screen for daily use. One row per lead awaiting outreach approval, with subject line preview and one-click approve, and a keyboard shortcut (`a` = approve, `e` = edit) for speed once the AE trusts the drafts.

### 3.4 Campaigns
List of saved ICP filters (the Apollo search definitions), each showing: active/paused toggle, leads sourced this month, avg score, conversion to booked-call rate. Editing a campaign edits the underlying `icp_filter` JSON via a simple form (industry, size range, title keywords, geography) — no raw JSON editing exposed to non-technical users.

### 3.5 Reports
Top-line KPI cards (leads sourced, avg score, reply rate, meetings booked, cost per qualified lead) plus one trend chart (leads → replies → meetings funnel, by week). This is the screen the founder/Head of Growth opens weekly — keep it to one scroll, no drill-down complexity in v1.

### 3.6 Settings
- Integration status (Apollo, Clay, Airtable, email provider) with last-sync timestamp and a "test connection" button per integration.
- ICP default filters.
- Prompt version selector (read-only view of current prompt + changelog — editing prompts happens in code/repo, not the UI, to keep versioning in git — see AI Context Core doc).

## 4. Visual Direction

- Neutral base (white/near-white background, dark slate text), single accent color for primary actions and score-tier badges (e.g., accent for "Hot", muted amber for "Warm", gray for "Cool") — color must carry meaning consistently across every screen.
- Data-forward typography: a clean sans-serif, tabular figures for scores/counts so numbers align in lists.
- Avoid decorative illustration — this tool should feel like a well-built internal instrument, not a marketing site.

## 5. Empty/Error States (don't skip these)

- Pipeline with zero leads → explain next scheduled sourcing run + link to Campaigns.
- Integration failure (e.g., Apollo auth expired) → non-blocking banner on every screen until resolved, since it silently stops the whole system otherwise.
- AI draft generation failure → lead stays at "Researched" with a visible retry button rather than silently stalling.
