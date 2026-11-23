"use client";

import { useEffect, useState } from "react";
import { useToast } from "./Toast";
import { useAuth } from "./AuthGate";
import { ErrorState, LoadingState } from "./States";
import { apiSend, notifyPipelineChanged, useApi } from "../../lib/useApi";
import { ACTION_LABELS, SCORE_PARTS, STEPS, stageLabel, stageStep, tierClass, tierLabel } from "../../lib/stages";
import type { LeadDetail, PipelineAction } from "../../lib/types";
import { trackEvent } from "../../lib/analytics";

const STEP_PATHS: Record<"research" | "score" | "draft", string> = {
  research: "research",
  score: "score",
  draft: "draft-outreach",
};

const DONE_MESSAGES: Record<"research" | "score" | "draft", string> = {
  research: "Research brief ready.",
  score: "Score updated.",
  draft: "Outreach drafted. Review it below.",
};

const dash = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

export default function LeadDossier({
  leadId,
  onClose,
  onChanged,
}: {
  leadId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canDecide = user?.role === "admin" || user?.role === "ae";

  const { data: details, error, loading, reload } = useApi<LeadDetail>(leadId ? `/leads/${leadId}` : null);
  const [busy, setBusy] = useState<PipelineAction | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const draft = details?.outreach.find((m) => m.status === "draft") ?? null;

  // Load the editor from the current draft whenever it changes (incl. after re-drafting)
  useEffect(() => {
    setSubject(draft?.subject ?? "");
    setBody(draft?.body ?? "");
  }, [draft?.id, draft?.subject, draft?.body]);

  useEffect(() => {
    if (!leadId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leadId, onClose]);

  if (!leadId) return null;

  const runStep = async (action: "research" | "score" | "draft") => {
    setBusy(action);
    try {
      await apiSend(`/leads/${leadId}/${STEP_PATHS[action]}`, "POST", undefined, `Couldn't ${action} this lead.`);
      showToast(DONE_MESSAGES[action]);
      if (action === "research") trackEvent("lead_researched", { leadId });
      await reload(true);
      onChanged();
      notifyPipelineChanged();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const decide = async (action: "approve" | "reject") => {
    if (action === "approve" && (!subject.trim() || !body.trim())) {
      showToast("Subject and message can't be empty.", "error");
      return;
    }
    setBusy(action);
    try {
      const res = await apiSend<{ transport?: string }>(
        `/leads/${leadId}/outreach/${action}`,
        "POST",
        action === "approve" ? { subject, body } : undefined,
        `Couldn't ${action} the draft.`
      );
      if (action === "approve") {
        showToast(res.transport === "mock" ? "Approved. Email logged (SMTP not configured)." : "Approved and sent.");
        trackEvent("lead_approved", { leadId });
      } else {
        showToast("Rejected. Draft removed.");
        trackEvent("lead_rejected", { leadId });
      }
      await reload(true);
      onChanged();
      notifyPipelineChanged();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const stepActions = (details?.allowed_actions ?? []).filter(
    (a): a is "research" | "score" | "draft" => a === "research" || a === "score" || a === "draft"
  );

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <aside className="dossier" role="dialog" aria-modal="true" aria-labelledby="dossier-title">
        <div className="dossier-head inv">
          <span>Lead</span>
          <button className="btn" type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        <div className="dossier-body">
          {loading && !details ? (
            <LoadingState label="Loading lead…" />
          ) : error && !details ? (
            <ErrorState message={error} onRetry={() => reload()} />
          ) : details ? (
            <>
              <h2 id="dossier-title">{details.lead.full_name}</h2>
              <div className="meta">
                {details.lead.title ? `${details.lead.title} at ` : ""}
                {details.company.name} · <a className="link" href={`mailto:${details.lead.email}`}>{details.lead.email}</a>
              </div>

              <div className={`row ${tierClass(details.score?.tier)}`} style={{ border: "1px solid var(--line)" }}>
                <div className="rail" style={{ gridTemplateColumns: "4px 1fr 90px" }}>
                  <span className="edge" />
                  <div>
                    <div className="stage">
                      {STEPS.map((_, s) => (
                        <i key={s} className={s < stageStep(details.lead.stage) ? "on" : ""} />
                      ))}
                    </div>
                    <div className="stagel">{stageLabel(details.lead.stage)}</div>
                  </div>
                  <div className="score">
                    {details.score?.total_score ?? "—"}
                    {details.score && <span className="tag">{tierLabel(details.score.tier)}</span>}
                  </div>
                </div>
              </div>

              {details.lead.do_not_contact && (
                <p className="notice">This lead opted out. No research, drafts or emails will be made.</p>
              )}

              {stepActions.length > 0 && (
                <div className="acts" style={{ borderTop: 0, paddingTop: 16 }}>
                  {stepActions.map((a, i) => (
                    <button
                      key={a}
                      type="button"
                      className={`btn${i === 0 ? " p" : ""}`}
                      disabled={busy !== null}
                      onClick={() => runStep(a)}
                    >
                      {busy === a ? "Working…" : ACTION_LABELS[a]}
                    </button>
                  ))}
                </div>
              )}

              <h3>Company</h3>
              <dl className="facts">
                <div><dt>Domain</dt><dd>{details.company.domain}</dd></div>
                <div><dt>Industry</dt><dd>{dash(details.company.industry)}</dd></div>
                <div><dt>Employees</dt><dd>{dash(details.company.employee_count)}</dd></div>
                <div><dt>Revenue</dt><dd>{dash(details.company.revenue_band)}</dd></div>
                <div><dt>Funding</dt><dd>{dash(details.company.funding_stage)}</dd></div>
                <div><dt>Tech stack</dt><dd>{details.company.tech_stack.length ? details.company.tech_stack.join(", ") : "—"}</dd></div>
                <div><dt>Hiring</dt><dd>{details.enrichment?.hiring_signals.length ? details.enrichment.hiring_signals.join(", ") : "—"}</dd></div>
                <div><dt>News</dt><dd>{details.enrichment?.news_triggers.length ? details.enrichment.news_triggers.join(", ") : "—"}</dd></div>
              </dl>

              {details.score && (
                <>
                  <h3>Score {details.score.total_score} / 100</h3>
                  {SCORE_PARTS.map((p) => {
                    const v = details.score![p.key];
                    return (
                      <div className="fr" key={p.key} style={{ gridTemplateColumns: "150px 1fr", padding: "4px 0" }}>
                        <div className="co">{p.label}</div>
                        <div className="meter" aria-label={`${v} of ${p.max}`}>
                          <span style={{ width: `${Math.min(100, (v / p.max) * 100)}%` }} />
                          <em>{v} / {p.max}</em>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {details.research && (
                <>
                  <h3>Research brief</h3>
                  {details.research.insufficient_signal && (
                    <p className="notice">
                      The AI found too little to personalise. No draft will be written; review this lead by hand.
                    </p>
                  )}
                  <p style={{ marginTop: 0 }}>{details.research.summary}</p>
                  {details.research.personalization_angles.length > 0 && (
                    <ul className="angles">
                      {details.research.personalization_angles.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {draft && (
                <>
                  <h3>Draft email</h3>
                  <input
                    className="subj"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    aria-label="Email subject"
                  />
                  <textarea
                    className="body editor"
                    rows={9}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    aria-label="Email body"
                  />
                  {canDecide ? (
                    <div className="acts">
                      <button className="btn p" type="button" disabled={busy !== null} onClick={() => decide("approve")}>
                        {busy === "approve" ? "Sending…" : "Approve and send"}
                      </button>
                      <button className="btn" type="button" disabled={busy !== null} onClick={() => decide("reject")}>
                        Reject
                      </button>
                      <span className="why">An unsubscribe link and postal address are added on send.</span>
                    </div>
                  ) : (
                    <p className="why" style={{ marginLeft: 0 }}>Only AEs and admins can approve or reject drafts.</p>
                  )}
                </>
              )}

              {details.outreach.filter((m) => m.status !== "draft").length > 0 && (
                <>
                  <h3>History</h3>
                  {details.outreach
                    .filter((m) => m.status !== "draft")
                    .map((m) => (
                      <div key={m.id} className="hook">
                        <div>
                          <b>{m.subject}</b>
                          <span className="url">
                            {m.status === "sent" && m.sent_at
                              ? `Sent ${new Date(m.sent_at).toLocaleString()}`
                              : m.status[0].toUpperCase() + m.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                </>
              )}
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}
