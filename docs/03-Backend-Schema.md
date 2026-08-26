# Backend Schema — LeadForge (Postgres)

Owned/written by the FastAPI service only. n8n never writes directly to Postgres — it always goes through FastAPI endpoints so validation, dedupe, and scoring logic stay in one place.

## 1. Entity Overview

```
organizations 1──* users
organizations 1──* companies 1──* leads
leads 1──1 enrichment_data
leads 1──* research_briefs
leads 1──1 lead_scores (latest) , lead_scores has history via score_id
leads 1──* outreach_messages
leads 1──* follow_ups
leads 1──* activity_log
organizations 1──* campaigns 1──* leads (campaign_id nullable FK)
```

`organizations` exists purely for multi-tenant readiness (TRD §9) — v1 seeds exactly one row and every table below carries `org_id`.

## 2. Tables

### `organizations`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| created_at | timestamptz | |

### `users`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK → organizations | |
| email | text unique | |
| name | text | |
| role | text | `admin` \| `ae` \| `ops` |
| created_at | timestamptz | |

### `companies`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| domain | text unique | primary dedupe key |
| name | text | |
| industry | text | |
| employee_count | int | |
| revenue_band | text | e.g. `2M-10M` |
| funding_stage | text | nullable |
| tech_stack | jsonb | array of detected tools |
| source | text | `apollo` \| `manual` |
| raw_enrichment | jsonb | full Clay payload, for audit |
| created_at | timestamptz | |

### `leads`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| company_id | uuid FK → companies | |
| campaign_id | uuid FK → campaigns, nullable | |
| full_name | text | |
| title | text | |
| email | text unique | |
| linkedin_url | text | nullable |
| email_verified | boolean | from Apollo/enrichment |
| stage | text | `new`→`enriched`→`researched`→`scored`→`outreach_drafted`→`outreach_sent`→`replied`→`booked`→`won`→`lost`→`unsubscribed` |
| do_not_contact | boolean default false | hard block, set on unsubscribe/bounce |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `enrichment_data`
1:1 with `leads`, kept separate from `companies` for person-level enrichment (vs firmographic).
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| lead_id | uuid FK unique | |
| seniority | text | |
| department | text | |
| hiring_signals | jsonb | open roles relevant to marketing/growth |
| news_triggers | jsonb | recent funding/leadership news |
| enriched_at | timestamptz | |

### `research_briefs`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| lead_id | uuid FK | |
| summary | text | AI-generated pain points/context |
| personalization_angles | jsonb | array of angle strings the outreach step can pull from |
| model_used | text | e.g. `claude-sonnet-5` |
| prompt_version | text | ties to versioned prompt in AI Context Core |
| created_at | timestamptz | |

### `lead_scores`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| lead_id | uuid FK | |
| fit_score | int | 0-30 |
| intent_score | int | 0-25 |
| gap_score | int | 0-20 |
| contactability_score | int | 0-15 |
| engagement_score | int | 0-10 |
| total_score | int | 0-100, generated column or computed on write |
| tier | text | `hot` \| `warm` \| `cool` |
| scoring_version | text | weights can change over time; keep history |
| created_at | timestamptz | append-only — latest row per lead_id is "current" |

### `outreach_messages`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| lead_id | uuid FK | |
| sequence_step | int | 1, 2, 3 |
| subject | text | |
| body | text | |
| status | text | `draft` \| `approved` \| `sent` \| `rejected` |
| approved_by | uuid FK → users, nullable | |
| sent_at | timestamptz nullable | |
| opened_at | timestamptz nullable | |
| replied_at | timestamptz nullable | |
| bounced | boolean default false | |
| prompt_version | text | |
| created_at | timestamptz | |

### `follow_ups`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| lead_id | uuid FK | |
| scheduled_for | timestamptz | |
| status | text | `pending` \| `sent` \| `skipped_replied` \| `skipped_dnc` |

### `campaigns`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| name | text | e.g. "Q1 DTC Push" |
| icp_filter | jsonb | saved Apollo search params |
| active | boolean | |
| created_at | timestamptz | |

### `activity_log`
Append-only audit trail for every automated or manual action on a lead.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| lead_id | uuid FK | |
| actor | text | `system` \| user email |
| action | text | e.g. `stage_changed`, `outreach_approved` |
| detail | jsonb | |
| created_at | timestamptz | |

### `pipeline_errors`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| stage | text | which pipeline step failed |
| payload | jsonb | offending payload for replay |
| error_message | text | |
| resolved | boolean default false | |
| created_at | timestamptz | |

## 3. Indexes (minimum)

- `companies(domain)` unique
- `leads(email)` unique
- `leads(company_id)`, `leads(stage)`, `leads(campaign_id)`
- `lead_scores(lead_id, created_at desc)` — fast "latest score" lookup
- `outreach_messages(lead_id, sequence_step)`

## 4. Example DDL (excerpt)

```sql
create table leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  company_id uuid not null references companies(id),
  campaign_id uuid references campaigns(id),
  full_name text not null,
  title text,
  email text not null unique,
  linkedin_url text,
  email_verified boolean default false,
  stage text not null default 'new'
    check (stage in ('new','enriched','researched','scored','outreach_drafted',
                      'outreach_sent','replied','booked','won','lost','unsubscribed')),
  do_not_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_leads_company on leads(company_id);
create index idx_leads_stage on leads(stage);
```
