"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";
import { trackEvent } from "../../lib/analytics";

interface Campaign {
  id: string;
  name: string;
  industry: string;
  company_sizes: string;
  active: boolean;
  leads_sourced: number;
  avg_score: number;
  conversion_rate: string;
}

export default function CampaignsPage() {
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("B2B SaaS");
  const [size, setSize] = useState("50-200 employees");

  const [campaigns, setCampaigns] = useState<Campaign[]>([
    {
      id: "1",
      name: "SaaS Series A Founders - US",
      industry: "B2B SaaS",
      company_sizes: "20-200 employees",
      active: true,
      leads_sourced: 142,
      avg_score: 78,
      conversion_rate: "4.2%",
    },
    {
      id: "2",
      name: "E-Commerce Marketing Directors - US",
      industry: "E-Commerce",
      company_sizes: "10-100 employees",
      active: false,
      leads_sourced: 89,
      avg_score: 62,
      conversion_rate: "2.1%",
    },
    {
      id: "3",
      name: "FinTech Executives - Global",
      industry: "FinTech",
      company_sizes: "50-500 employees",
      active: true,
      leads_sourced: 55,
      avg_score: 85,
      conversion_rate: "5.8%",
    },
  ]);

  const toggleCampaign = (id: string) => {
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextState = !c.active;
          showToast(
            `Campaign "${c.name}" ${nextState ? "activated" : "paused"}.`
          );
          trackEvent("campaign_toggled", { campaignId: id, active: nextState });
          return { ...c, active: nextState };
        }
        return c;
      })
    );
  };

  const handleAddCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCamp: Campaign = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      industry,
      company_sizes: size,
      active: true,
      leads_sourced: 0,
      avg_score: 0,
      conversion_rate: "0.0%",
    };

    setCampaigns((prev) => [newCamp, ...prev]);
    setShowModal(false);
    setName("");
    showToast(`Campaign profile "${name}" created.`);
    trackEvent("campaign_created", { name, industry, size });
  };

  return (
    <div>
      <h1>Campaigns</h1>
      <p className="sub">
        Define who each campaign targets. Scores are measured against these profiles.
      </p>

      {campaigns.length === 0 ? (
        <div className="empty" style={{ textAlign: "left", padding: "24px 0" }}>
          No campaign profiles yet. Add the company size, roles and signals you want to reach.
          <br />
          <br />
          <button
            className="btn p"
            onClick={() => setShowModal(true)}
            type="button"
          >
            Add campaign profile
          </button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: "20px", display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn p"
              onClick={() => setShowModal(true)}
              type="button"
            >
              Add campaign profile
            </button>
          </div>

          <div className="rail head" style={{ gridTemplateColumns: "1.8fr 1fr 100px 100px 90px 100px" }}>
            <span>Campaign Profile</span>
            <span>Targeting</span>
            <span style={{ textAlign: "right" }}>Sourced</span>
            <span style={{ textAlign: "right" }}>Avg Score</span>
            <span style={{ textAlign: "right" }}>Conv Rate</span>
            <span style={{ textAlign: "right" }}>Status</span>
          </div>

          {campaigns.map((c, i) => (
            <div
              key={c.id}
              className={`row ${i % 2 === 1 ? "inv" : ""}`}
              style={{ padding: "16px 0" }}
            >
              <div
                className="rail"
                style={{ gridTemplateColumns: "1.8fr 1fr 100px 100px 90px 100px" }}
              >
                <div>
                  <div className="nm">{c.name}</div>
                  <div className="co">{c.industry}</div>
                </div>

                <div className="co">{c.company_sizes}</div>

                <div style={{ textAlign: "right", fontWeight: 700, fontSize: "16px" }}>
                  {c.leads_sourced}
                </div>

                <div style={{ textAlign: "right", fontWeight: 700, fontSize: "16px" }}>
                  {c.avg_score || "-"}
                </div>

                <div style={{ textAlign: "right", fontWeight: 700, fontSize: "16px" }}>
                  {c.conversion_rate}
                </div>

                <div style={{ textAlign: "right" }}>
                  <button
                    onClick={() => toggleCampaign(c.id)}
                    className="btn"
                    style={{
                      padding: "4px 10px",
                      fontSize: "12px",
                      background: c.active ? "var(--ink)" : "var(--panel)",
                      color: c.active ? "var(--bg)" : "var(--ink)",
                    }}
                    type="button"
                  >
                    {c.active ? "Active" : "Paused"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Add Campaign Modal */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "16px",
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "var(--bg)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              padding: "28px",
              maxWidth: "480px",
              width: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 8px" }}>
              Add Campaign Profile
            </h2>
            <p className="sub" style={{ marginBottom: "20px" }}>
              Configure Apollo search filters and scoring thresholds for this ICP segment.
            </p>

            <form onSubmit={handleAddCampaign} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Campaign Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. US Series B SaaS Growth Roles"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--line)",
                    background: "var(--panel)",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Industry
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--line)",
                    background: "var(--panel)",
                  }}
                >
                  <option value="B2B SaaS">B2B SaaS</option>
                  <option value="E-Commerce / DTC">E-Commerce / DTC</option>
                  <option value="FinTech">FinTech</option>
                  <option value="Healthcare Tech">Healthcare Tech</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Company Size
                </label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--line)",
                    background: "var(--panel)",
                  }}
                >
                  <option value="10-50 employees">10-50 employees</option>
                  <option value="50-200 employees">50-200 employees</option>
                  <option value="200-500 employees">200-500 employees</option>
                  <option value="500+ employees">500+ employees</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn p">
                  Save profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
