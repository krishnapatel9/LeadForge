// Mirrors apps/api/models/schemas.py and the router responses. Keep in sync.

export type Tier = "hot" | "warm" | "cool";

export type Stage =
  | "new"
  | "enriched"
  | "researched"
  | "scored"
  | "outreach_drafted"
  | "outreach_sent"
  | "replied"
  | "booked"
  | "won"
  | "lost"
  | "unsubscribed";

export type PipelineAction = "research" | "score" | "draft" | "approve" | "reject";

export interface LeadListItem {
  id: string;
  full_name: string;
  title: string | null;
  email: string;
  stage: Stage;
  do_not_contact: boolean;
  company_name: string;
  company_domain: string;
  created_at: string;
  tier: Tier | null;
  total_score: number | null;
}

export interface Company {
  id: string;
  domain: string;
  name: string;
  industry: string | null;
  employee_count: number | null;
  revenue_band: string | null;
  funding_stage: string | null;
  tech_stack: string[];
  source: string;
  created_at: string;
}

export interface OutreachMessage {
  id: string;
  sequence_step: number;
  subject: string;
  body: string;
  status: "draft" | "approved" | "sent" | "rejected";
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  bounced: boolean;
  prompt_version: string;
  created_at: string;
}

export interface ScoreBreakdown {
  fit_score: number;
  intent_score: number;
  gap_score: number;
  contactability_score: number;
  engagement_score: number;
  total_score: number;
  tier: Tier;
}

export interface LeadDetail {
  lead: {
    id: string;
    full_name: string;
    title: string | null;
    email: string;
    linkedin_url: string | null;
    email_verified: boolean;
    stage: Stage;
    do_not_contact: boolean;
    created_at: string;
  };
  company: Company;
  enrichment: { hiring_signals: string[]; news_triggers: string[]; enriched_at: string | null } | null;
  research: { summary: string; personalization_angles: string[]; insufficient_signal: boolean } | null;
  score: ScoreBreakdown | null;
  outreach: OutreachMessage[];
  allowed_actions: PipelineAction[];
}

export interface DraftItem {
  lead_id: string;
  message_id: string;
  full_name: string;
  title: string | null;
  email: string;
  company_name: string;
  tier: Tier | null;
  total_score: number | null;
  subject: string;
  body: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  industry: string | null;
  company_size: string | null;
  active: boolean;
  leads_sourced: number;
  avg_score: number | null;
  emails_sent: number;
  replies: number;
  conversion_rate: number | null;
}

export interface Kpi {
  key: string;
  label: string;
  value: number | null;
  format: "int" | "score" | "pct";
  delta: number | null;
  delta_format: "pct" | "pts" | "pct_pts";
}

export interface ReportSummary {
  days: number;
  kpis: Kpi[];
  funnel: { stage: string; count: number }[];
  meeting_rate: number | null;
}

export interface ServiceStatus {
  name: string;
  description: string;
  status: "ok" | "not_configured" | "error";
  detail: string;
}

export interface SystemHealth {
  ok: boolean;
  database: string;
  gemini_api: string;
  smtp: string;
  unresolved_pipeline_errors: number;
  services: ServiceStatus[];
  public_api_url: string;
  webhooks: { title: string; method: string; url: string; auth: string }[];
}
