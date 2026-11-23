"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";
import { ErrorState, LoadingState } from "../components/States";
import { trackEvent } from "../../lib/analytics";
import { apiErrorMessage, apiFetch } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import type { ServiceStatus, SystemHealth } from "../../lib/types";

const STATUS_TEXT: Record<ServiceStatus["status"], string> = {
  ok: "Connected",
  not_configured: "Not set up",
  error: "Failing",
};

export default function IntegrationsPage() {
  const { showToast } = useToast();
  const { data, error, loading, reload, setData } = useApi<SystemHealth>("/system-health");
  const [testing, setTesting] = useState<string | null>(null);

  const test = async (name: string) => {
    setTesting(name);
    trackEvent("connection_tested", { service: name });
    try {
      const probe = name === "Google Gemini" ? "?probe=gemini" : "";
      const res = await apiFetch(`/system-health${probe}`);
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Check failed."));
      const fresh = (await res.json()) as SystemHealth;
      setData(fresh);
      const svc = fresh.services.find((s) => s.name === name);
      if (svc) showToast(`${name}: ${svc.detail}`, svc.status === "error" ? "error" : "info");
    } catch (err) {
      showToast(err instanceof TypeError ? "Can't reach the LeadForge API." : (err as Error).message, "error");
    } finally {
      setTesting(null);
    }
  };

  const copy = (url: string) => {
    try {
      navigator.clipboard.writeText(url).then(
        () => showToast("Address copied"),
        () => showToast("Copy blocked by the browser", "error")
      );
    } catch {
      showToast("Copy blocked by the browser", "error");
    }
  };

  return (
    <div>
      <h1>Integrations</h1>
      <p className="sub">Check that each connected service is responding.</p>

      {loading && !data ? (
        <LoadingState label="Checking services…" />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={() => reload()} />
      ) : data ? (
        <>
          {data.services.map((x, i) => (
            <div key={x.name} className={`int${i % 2 ? " inv" : ""}`}>
              <b>{x.name}</b>
              <span className="d" style={{ color: "var(--mute)" }}>
                {x.description}
                <br />
                <small>{x.detail}</small>
              </span>
              <span className={`st ${x.status === "ok" ? "ok" : "wm"}`}>
                <i className={`dot${x.status === "ok" ? "" : " hollow"}`} style={{ background: "currentColor" }} />
                {STATUS_TEXT[x.status]}
              </span>
              <button className="link" type="button" onClick={() => test(x.name)} disabled={testing !== null}>
                {testing === x.name ? "Checking…" : x.name === "Google Gemini" ? "Test model" : "Check again"}
              </button>
            </div>
          ))}

          {data.unresolved_pipeline_errors > 0 && (
            <p className="notice" style={{ marginTop: 16 }}>
              {data.unresolved_pipeline_errors} pipeline step
              {data.unresolved_pipeline_errors === 1 ? " has" : "s have"} failed recently (research, drafting or
              sending). Details are in the pipeline_errors table and the API log.
            </p>
          )}

          <h3>Webhook addresses</h3>
          <p className="sub" style={{ marginBottom: 8 }}>
            Point Apollo, Clay or n8n at these. Each call needs the service key in the X-API-Key header.
          </p>
          {data.webhooks.map((h, i) => (
            <div key={h.url} className={`hook${i % 2 ? " inv" : ""}`}>
              <div>
                <b>{h.title}</b>
                <span className="url">
                  {h.method} {h.url}
                </span>
              </div>
              <button className="btn" type="button" onClick={() => copy(h.url)}>
                Copy address
              </button>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
