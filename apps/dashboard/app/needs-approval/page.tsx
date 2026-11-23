"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useToast } from "../components/Toast";
import { useAuth } from "../components/AuthGate";
import { ErrorState, LoadingState } from "../components/States";
import { trackEvent } from "../../lib/analytics";
import { apiSend, notifyPipelineChanged, useApi } from "../../lib/useApi";
import type { DraftItem } from "../../lib/types";

export default function NeedsApprovalPage() {
  const { data, error, loading, reload, setData } = useApi<DraftItem[]>("/outreach/drafts");
  const drafts = data ?? [];
  const { showToast } = useToast();
  const { user } = useAuth();
  const canDecide = user?.role === "admin" || user?.role === "ae";

  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);
  // Edited bodies per message, so switching drafts doesn't lose work
  const edits = useRef<Record<string, string>>({});
  const bodyRef = useRef<HTMLDivElement>(null);

  const current = drafts[Math.min(sel, Math.max(drafts.length - 1, 0))];

  useEffect(() => {
    if (sel > 0 && sel >= drafts.length) setSel(Math.max(drafts.length - 1, 0));
  }, [drafts.length, sel]);

  // The body is a contentEditable div. React must not own its children (that
  // resets the caret on every keystroke), so its text is written here, once per draft.
  useLayoutEffect(() => {
    if (!current) return;
    setSubject(current.subject);
    setEditing(false);
    if (bodyRef.current) bodyRef.current.innerText = edits.current[current.message_id] ?? current.body;
  }, [current?.message_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentBody = useCallback(() => bodyRef.current?.innerText ?? current?.body ?? "", [current]);

  const removeCurrent = useCallback(() => {
    if (!current) return;
    delete edits.current[current.message_id];
    setData((prev) => (prev ?? []).filter((d) => d.message_id !== current.message_id));
    notifyPipelineChanged();
    setEditing(false);
  }, [current, setData]);

  const approve = useCallback(async () => {
    if (!current || saving || !canDecide) return;
    const body = currentBody();
    if (!subject.trim() || !body.trim()) {
      showToast("Subject and message can't be empty.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await apiSend<{ transport?: string }>(
        `/leads/${current.lead_id}/outreach/approve`,
        "POST",
        { subject, body },
        "Failed to approve draft."
      );
      showToast(
        res.transport === "mock"
          ? `Approved. Email to ${current.full_name} logged (SMTP not configured).`
          : `Approved. ${current.full_name} has been emailed.`
      );
      trackEvent("lead_approved", { leadId: current.lead_id });
      removeCurrent();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }, [current, saving, canDecide, subject, showToast, removeCurrent, currentBody]);

  const reject = useCallback(async () => {
    if (!current || saving || !canDecide) return;
    setSaving(true);
    try {
      await apiSend(`/leads/${current.lead_id}/outreach/reject`, "POST", undefined, "Failed to reject draft.");
      showToast("Rejected. Draft removed.");
      trackEvent("lead_rejected", { leadId: current.lead_id });
      removeCurrent();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }, [current, saving, canDecide, showToast, removeCurrent]);

  const toggleEdit = useCallback(() => {
    if (!current) return;
    if (editing) {
      edits.current[current.message_id] = currentBody();
      setEditing(false);
    } else {
      setEditing(true);
      requestAnimationFrame(() => bodyRef.current?.focus());
    }
  }, [editing, current, currentBody]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!drafts.length || saving) return;
      const k = e.key.toLowerCase();
      if (k === "j" && sel < drafts.length - 1) {
        e.preventDefault();
        setSel((i) => i + 1);
      } else if (k === "k" && sel > 0) {
        e.preventDefault();
        setSel((i) => i - 1);
      } else if (k === "a") {
        e.preventDefault();
        approve();
      } else if (k === "r") {
        e.preventDefault();
        reject();
      } else if (k === "e") {
        e.preventDefault();
        toggleEdit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drafts.length, sel, saving, approve, reject, toggleEdit]);

  const header = (
    <>
      <h1>Approvals</h1>
      <p className="sub">
        {drafts.length
          ? "Read each draft, change what you like, then approve it for sending."
          : "Drafts written by the AI wait here until you approve them."}
      </p>
    </>
  );

  if (loading && !data) return <div>{header}<LoadingState label="Loading drafts…" /></div>;
  if (error && !data) return <div>{header}<ErrorState message={error} onRetry={() => reload()} /></div>;
  if (!current) {
    return (
      <div>
        {header}
        <div className="empty">Nothing to review. New drafts appear here as leads are scored.</div>
      </div>
    );
  }

  return (
    <div>
      {header}
      <div className="appr">
        <div className="queue inv" role="listbox" aria-label="Drafts awaiting approval">
          {drafts.map((x, i) => (
            <button
              key={x.message_id}
              className="qi"
              role="option"
              aria-selected={x.message_id === current.message_id}
              onClick={() => {
                if (editing) edits.current[current.message_id] = currentBody();
                setSel(i);
              }}
              type="button"
            >
              <b>{x.full_name}</b>
              <small>
                {x.title ? `${x.title}, ` : ""}
                {x.company_name}
              </small>
              <small>{x.total_score === null ? "Not scored" : `Score ${x.total_score}`}</small>
            </button>
          ))}
        </div>

        <div className="letter">
          <h2>{current.full_name}</h2>
          <div className="meta">
            {current.title ? `${current.title} at ` : ""}
            {current.company_name}
          </div>
          <input
            className="subj"
            id="subj"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Subject"
          />
          <div
            className="body"
            id="body"
            ref={bodyRef}
            contentEditable={editing}
            suppressContentEditableWarning
            aria-label="Email body"
            aria-multiline="true"
            role="textbox"
          />
          <div className="acts">
            <button className="btn p" type="button" onClick={approve} disabled={saving || !canDecide}>
              {saving ? "Sending…" : "Approve and queue"}
              <kbd>A</kbd>
            </button>
            <button className="btn" type="button" onClick={toggleEdit} disabled={saving}>
              {editing ? "Done editing" : "Edit"}
              <kbd>E</kbd>
            </button>
            <button className="btn" type="button" onClick={reject} disabled={saving || !canDecide}>
              Reject
              <kbd>R</kbd>
            </button>
            <span className="why">
              {canDecide ? "J / K to switch drafts" : "Only AEs and admins can approve or reject"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
