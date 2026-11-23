import type { PipelineAction, Stage, Tier } from "./types";

// The prototype's four-step progress bar, mapped from the API's real stages
// (apps/api/services/lead_state.py). Later stages fill all four steps;
// stopped leads (lost, unsubscribed) show an empty bar.
export const STEPS = ["Ingested", "Researched", "Scored", "Drafted"] as const;

export function stageStep(stage: Stage): number {
  switch (stage) {
    case "new":
    case "enriched":
      return 1;
    case "researched":
      return 2;
    case "scored":
      return 3;
    case "lost":
    case "unsubscribed":
      return 0; // stopped: show an empty bar rather than a "complete" one
    default:
      return 4;
  }
}

const STAGE_LABELS: Record<Stage, string> = {
  new: "Ingested",
  enriched: "Ingested",
  researched: "Researched",
  scored: "Scored",
  outreach_drafted: "Drafted",
  outreach_sent: "Sent",
  replied: "Replied",
  booked: "Booked",
  won: "Won",
  lost: "Lost",
  unsubscribed: "Unsubscribed",
};

export function stageLabel(stage: Stage): string {
  return STAGE_LABELS[stage] ?? stage;
}

export const STOPPED_STAGES: Stage[] = ["lost", "unsubscribed"];

export const KANBAN_COLUMNS: { title: string; stages: Stage[] }[] = [
  { title: "Ingested", stages: ["new", "enriched"] },
  { title: "Researched", stages: ["researched"] },
  { title: "Scored", stages: ["scored"] },
  { title: "Drafted", stages: ["outreach_drafted"] },
  { title: "Sent", stages: ["outreach_sent", "replied", "booked", "won"] },
  { title: "Stopped", stages: STOPPED_STAGES },
];

/** CSS class for the row edge/score: the prototype styles hot and warm; everything else is "none". */
export function tierClass(tier: Tier | null | undefined): "hot" | "warm" | "none" {
  return tier === "hot" || tier === "warm" ? tier : "none";
}

export function tierLabel(tier: Tier | null | undefined): string | null {
  if (!tier) return null;
  return tier[0].toUpperCase() + tier.slice(1);
}

export const ACTION_LABELS: Record<Exclude<PipelineAction, "approve" | "reject">, string> = {
  research: "Run AI research",
  score: "Compute ICP score",
  draft: "Draft outreach",
};

export const SCORE_PARTS: { key: "fit_score" | "intent_score" | "gap_score" | "contactability_score" | "engagement_score"; label: string; max: number }[] = [
  { key: "fit_score", label: "Fit (firmographics)", max: 30 },
  { key: "intent_score", label: "Intent (signals)", max: 25 },
  { key: "gap_score", label: "Gaps", max: 20 },
  { key: "contactability_score", label: "Contactability", max: 15 },
  { key: "engagement_score", label: "Engagement", max: 10 },
];
