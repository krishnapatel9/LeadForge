# n8n Workflow — POC Pipeline (build manually in your n8n instance)

An exported n8n JSON isn't included here since it needs live credential IDs from
your n8n instance to import cleanly — build these 4 nodes manually, it's a
5-minute wire-up once the API above is running.

## Nodes

1. **Manual Trigger** (or Schedule Trigger, daily, for later)
2. **Apollo — Search People** node (HTTP Request node if no native Apollo node
   available): call Apollo's people search API with your ICP filter, limit
   results to your `MAX_LEADS_PER_RUN` (start with 5 for testing).
3. **Clay — Enrich** (webhook out to a Clay table configured with the
   enrichment waterfall from TRD §5; Clay webhooks the enriched row back).
4. **HTTP Request → LeadForge API**: `POST http://<your-api-host>:8000/poc/process-lead`
   with the enriched payload mapped to the `LeadInput` schema
   (`apps/api/models/schemas.py`).

## Testing without Apollo/Clay wired up yet

Skip nodes 2-3 initially and just hit the API directly to validate the core
loop end to end:

```bash
curl -X POST http://localhost:8000/poc/process-lead \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Acme SaaS",
    "domain": "acme.com",
    "industry": "saas",
    "employee_count": 80,
    "revenue_band": "5M-10M",
    "funding_stage": "Series B",
    "tech_stack": ["HubSpot", "Segment"],
    "hiring_signals": ["Growth Marketer", "Demand Gen Manager"],
    "news_triggers": ["Raised $15M Series B"],
    "full_name": "Jane Doe",
    "title": "VP Marketing",
    "email": "jane@acme.com",
    "linkedin_url": "https://linkedin.com/in/janedoe",
    "email_verified": true
  }'
```

Check `poc_results.csv` at the repo root afterward — one row should appear
with the research brief, score breakdown, and (since this is a Hot lead) an
outreach draft.

## Once the API loop is proven

Add nodes 2-3 back in, replace the Manual Trigger with a Schedule Trigger,
and add error-branch handling (n8n's "Continue on Fail" + a final node that
POSTs failures to a Slack channel or logs them — `pipeline_errors` table
handling is Phase 2, once Postgres is in the loop).
