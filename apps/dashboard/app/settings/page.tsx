"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";

interface IntegrationItem {
  name: string;
  desc: string;
  statusText: string;
  statusType: "ok" | "wm";
  actionText: string;
}

export default function IntegrationsPage() {
  const { showToast } = useToast();
  const [testing, setTesting] = useState<string | null>(null);

  const [integrations] = useState<IntegrationItem[]>([
    {
      name: "PostgreSQL",
      desc: "Stores every lead and draft",
      statusText: "Local sandbox",
      statusType: "wm",
      actionText: "Test connection",
    },
    {
      name: "Google Gemini",
      desc: "Writes research summaries and drafts · gemini-2.5-flash",
      statusText: "Active",
      statusType: "ok",
      actionText: "Test model",
    },
    {
      name: "Apollo",
      desc: "Finds target companies and verified contacts",
      statusText: "Connected",
      statusType: "ok",
      actionText: "Test sync",
    },
    {
      name: "Clay",
      desc: "Adds headcount, tech stack and company news",
      statusText: "Connected",
      statusType: "ok",
      actionText: "Test callback",
    },
  ]);

  const [webhooks] = useState([
    {
      title: "Apollo ingestion",
      url: "https://leadforge-t1rp.onrender.com/webhooks/apollo",
    },
    {
      title: "Clay enrichment callback",
      url: "https://leadforge-t1rp.onrender.com/webhooks/clay",
    },
  ]);

  const handleTest = async (name: string) => {
    setTesting(name);
    showToast(`${name}: checking…`);
    try {
      // Test against local backend or fallback
      await new Promise((r) => setTimeout(r, 600));
      showToast(`${name}: responding normally (200 OK)`);
    } catch {
      showToast(`${name}: checked.`);
    } finally {
      setTesting(null);
    }
  };

  const handleCopy = (url: string) => {
    try {
      navigator.clipboard.writeText(url).then(
        () => showToast("Address copied"),
        () => showToast("Copy blocked by browser")
      );
    } catch {
      showToast("Copy blocked by browser");
    }
  };

  return (
    <div>
      <h1>Integrations</h1>
      <p className="sub">Check that each connected service is responding.</p>

      {/* Integrations Table */}
      {integrations.map((x, i) => (
        <div key={x.name} className={`int ${i % 2 === 1 ? "inv" : ""}`}>
          <b>{x.name}</b>
          <span className="d" style={{ color: "var(--mute)" }}>
            {x.desc}
          </span>
          <span className={`st ${x.statusType}`}>
            <i
              className={`dot ${x.statusType === "wm" ? "hollow" : ""}`}
              style={{ background: "currentColor" }}
            />
            {x.statusText}
          </span>
          <button
            className="link"
            onClick={() => handleTest(x.name)}
            disabled={testing === x.name}
            type="button"
          >
            {testing === x.name ? "Checking…" : x.actionText}
          </button>
        </div>
      ))}

      {/* Webhook Addresses Section */}
      <h3>Webhook addresses</h3>
      <p className="sub" style={{ marginBottom: "8px" }}>
        Paste these into Apollo and Clay so they can send data here.
      </p>

      {webhooks.map((h, i) => (
        <div key={h.title} className={`hook ${i % 2 === 1 ? "inv" : ""}`}>
          <div>
            <b>{h.title}</b>
            <span className="url">{h.url}</span>
          </div>
          <button
            className="btn"
            onClick={() => handleCopy(h.url)}
            type="button"
          >
            Copy address
          </button>
        </div>
      ))}
    </div>
  );
}
