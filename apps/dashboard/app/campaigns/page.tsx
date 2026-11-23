"use client";

import { FormEvent, useEffect, useState } from "react";
import { useToast } from "../components/Toast";
import { useAuth } from "../components/AuthGate";
import { ErrorState, LoadingState } from "../components/States";
import { trackEvent } from "../../lib/analytics";
import { apiSend, useApi } from "../../lib/useApi";
import type { Campaign } from "../../lib/types";

const INDUSTRIES = ["SaaS", "E-commerce / DTC", "FinTech", "Healthcare Tech", "Other"];
const SIZES = ["10-50 employees", "50-200 employees", "200-500 employees", "500+ employees"];

export default function CampaignsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "ops";
  const { data, error, loading, reload } = useApi<Campaign[]>("/campaigns");
  const campaigns = data ?? [];

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowModal(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModal]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiSend("/campaigns", "POST", { name: name.trim(), industry, company_size: size }, "Couldn't save the profile.");
      showToast(`Campaign profile "${name.trim()}" created.`);
      trackEvent("campaign_created", { industry, size });
      setShowModal(false);
      setName("");
      await reload(true);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Campaign) => {
    setToggling(c.id);
    try {
      await apiSend(`/campaigns/${c.id}`, "PATCH", { active: !c.active }, "Couldn't update the campaign.");
      showToast(`Campaign "${c.name}" ${c.active ? "paused" : "activated"}.`);
      trackEvent("campaign_toggled", { campaignId: c.id, active: !c.active });
      await reload(true);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setToggling(null);
    }
  };

  const addButton = canEdit && (
    <button className="btn p" type="button" onClick={() => setShowModal(true)}>
      Add campaign profile
    </button>
  );

  return (
    <div>
      <h1>Campaigns</h1>
      <p className="sub">Define who each campaign targets. Scores are measured against these profiles.</p>

      {loading && !data ? (
        <LoadingState label="Loading campaigns…" />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={() => reload()} />
      ) : campaigns.length === 0 ? (
        <div className="empty" style={{ textAlign: "left", padding: "24px 0" }}>
          No campaign profiles yet. Add the company size, roles and signals you want to reach.
          {addButton && (
            <>
              <br />
              <br />
              {addButton}
            </>
          )}
        </div>
      ) : (
        <>
          {addButton && <div style={{ marginBottom: 20, display: "flex", justifyContent: "flex-end" }}>{addButton}</div>}

          <div className="rail head camp">
            <span>Campaign profile</span>
            <span>Targeting</span>
            <span style={{ textAlign: "right" }}>Sourced</span>
            <span style={{ textAlign: "right" }}>Avg score</span>
            <span style={{ textAlign: "right" }}>Reply rate</span>
            <span style={{ textAlign: "right" }}>Status</span>
          </div>

          {campaigns.map((c, i) => (
            <div key={c.id} className={`row${i % 2 ? " inv" : ""}`} style={{ padding: "16px 0" }}>
              <div className="rail camp">
                <div>
                  <div className="nm">{c.name}</div>
                  <div className="co">{c.industry ?? "Any industry"}</div>
                </div>
                <div className="co">{c.company_size ?? "Any size"}</div>
                <div className="num">{c.leads_sourced}</div>
                <div className="num">{c.avg_score ?? "—"}</div>
                <div className="num">{c.conversion_rate === null ? "—" : `${(c.conversion_rate * 100).toFixed(1)}%`}</div>
                <div style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className={`btn${c.active ? " p" : ""}`}
                    style={{ padding: "4px 10px", fontSize: 12 }}
                    onClick={() => toggle(c)}
                    disabled={!canEdit || toggling === c.id}
                    aria-pressed={c.active}
                    title={canEdit ? (c.active ? "Pause" : "Activate") : "Only admins and ops can change campaigns"}
                  >
                    {c.active ? "Active" : "Paused"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {showModal && (
        <div className="modal-scrim" role="presentation" onClick={() => setShowModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="camp-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="camp-title">Add campaign profile</h2>
            <p className="sub" style={{ marginBottom: 20 }}>
              The industry and company size this campaign targets.
            </p>
            <form onSubmit={add} className="auth-card" style={{ border: 0, padding: 0, maxWidth: "none" }}>
              <label className="auth-field">
                <span>Campaign name</span>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. US Series B SaaS growth roles"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="auth-field">
                <span>Industry</span>
                <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                  {INDUSTRIES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="auth-field">
                <span>Company size</span>
                <select value={size} onChange={(e) => setSize(e.target.value)}>
                  {SIZES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <div className="acts" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn p" disabled={saving || !name.trim()}>
                  {saving ? "Saving…" : "Save profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
