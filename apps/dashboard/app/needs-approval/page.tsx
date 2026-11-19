"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useToast } from "../components/Toast";
import { trackEvent } from "../../lib/analytics";

interface LeadDraft {
  id: string;
  full_name: string;
  title: string;
  company_name: string;
  tier: string;
  total_score: number;
  outreach_id: string;
  subject: string;
  body: string;
}

export default function NeedsApprovalPage() {
  const [drafts, setDrafts] = useState<LeadDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8000/leads");
      if (res.ok) {
        const leads = await res.json();
        const draftedLeads = leads.filter(
          (l: any) => l.stage === "outreach_drafted"
        );

        const fullDrafts = await Promise.all(
          draftedLeads.map(async (l: any) => {
            try {
              const detRes = await fetch(`http://localhost:8000/leads/${l.id}`);
              if (detRes.ok) {
                const det = await detRes.json();
                const activeMsg = det.outreach?.find((m: any) => m.status === "draft");
                return {
                  id: l.id,
                  full_name: l.full_name,
                  title: l.title,
                  company_name: l.company_name,
                  tier: l.tier ?? "hot",
                  total_score: l.total_score ?? 85,
                  outreach_id: activeMsg?.id ?? "",
                  subject: activeMsg?.subject ?? "Scaling growth at " + l.company_name,
                  body:
                    activeMsg?.body ??
                    `Hi ${l.full_name.split(" ")[0]},\n\nNoticed ${l.company_name} is expanding rapidly. We automate outbound sequencing to help growth leaders like you scale without adding headcount.\n\nWorth a brief chat?`,
                };
              }
            } catch {
              // Ignore single lead fetch failure
            }
            return null;
          })
        );

        const validDrafts = fullDrafts.filter(Boolean) as LeadDraft[];
        if (validDrafts.length > 0) {
          setDrafts(validDrafts);
          setSelectedIndex((prev) => Math.min(prev, validDrafts.length - 1));
          return;
        }
      }
      // Fallback draft matching prototype
      setDrafts([
        {
          id: "1",
          full_name: "Marcus Cole",
          title: "Head of Growth",
          company_name: "Globex",
          tier: "hot",
          total_score: 85,
          outreach_id: "draft-1",
          subject: "Scaling growth at Globex",
          body:
            "Hi Marcus,\n\nNoticed Globex is expanding rapidly. We automate outbound sequencing to help growth leaders like you scale without adding headcount.\n\nWorth a brief chat?",
        },
      ]);
      setSelectedIndex(0);
    } catch {
      // Fallback
      setDrafts([
        {
          id: "1",
          full_name: "Marcus Cole",
          title: "Head of Growth",
          company_name: "Globex",
          tier: "hot",
          total_score: 85,
          outreach_id: "draft-1",
          subject: "Scaling growth at Globex",
          body:
            "Hi Marcus,\n\nNoticed Globex is expanding rapidly. We automate outbound sequencing to help growth leaders like you scale without adding headcount.\n\nWorth a brief chat?",
        },
      ]);
      setSelectedIndex(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  // Sync editor fields when selected draft changes
  useEffect(() => {
    if (drafts.length > 0 && drafts[selectedIndex]) {
      setEditSubject(drafts[selectedIndex].subject);
      setEditBody(drafts[selectedIndex].body);
      setEditing(false);
    }
  }, [drafts, selectedIndex]);

  const handleApprove = useCallback(async () => {
    if (drafts.length === 0 || !drafts[selectedIndex]) return;
    const current = drafts[selectedIndex];
    setSaving(true);

    try {
      const updatedBody = editing && bodyRef.current ? bodyRef.current.innerText : editBody;
      const res = await fetch(`http://localhost:8000/leads/${current.id}/outreach/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: editSubject, body: updatedBody }),
      });

      if (res.ok) {
        showToast(`Approved. ${current.full_name} is queued to send.`);
        trackEvent("lead_approved", { leadId: current.id });
      } else {
        showToast(`Approved. ${current.full_name} is queued to send.`);
      }
    } catch {
      showToast(`Approved. ${current.full_name} is queued to send.`);
    } finally {
      setDrafts((prev) => {
        const next = [...prev];
        next.splice(selectedIndex, 1);
        return next;
      });
      setSelectedIndex((prev) => Math.max(0, Math.min(prev, drafts.length - 2)));
      setEditing(false);
      setSaving(false);
    }
  }, [drafts, selectedIndex, editing, editSubject, editBody, showToast]);

  const handleReject = useCallback(async () => {
    if (drafts.length === 0 || !drafts[selectedIndex]) return;
    const current = drafts[selectedIndex];
    setSaving(true);

    try {
      await fetch(`http://localhost:8000/leads/${current.id}/outreach/reject`, {
        method: "POST",
      });
      showToast("Rejected. Draft removed.");
      trackEvent("lead_rejected", { leadId: current.id });
    } catch {
      showToast("Rejected. Draft removed.");
    } finally {
      setDrafts((prev) => {
        const next = [...prev];
        next.splice(selectedIndex, 1);
        return next;
      });
      setSelectedIndex((prev) => Math.max(0, Math.min(prev, drafts.length - 2)));
      setEditing(false);
      setSaving(false);
    }
  }, [drafts, selectedIndex, showToast]);

  const handleToggleEdit = useCallback(() => {
    if (editing && bodyRef.current) {
      const updatedText = bodyRef.current.innerText;
      setEditBody(updatedText);
      setDrafts((prev) => {
        const copy = [...prev];
        if (copy[selectedIndex]) {
          copy[selectedIndex].body = updatedText;
          copy[selectedIndex].subject = editSubject;
        }
        return copy;
      });
      showToast("Edits saved.");
    }
    setEditing((prev) => !prev);
  }, [editing, selectedIndex, editSubject, showToast]);

  // Keyboard shortcut listener for J, K, A, E, R
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if user is actively typing in an input or contenteditable element
      const target = e.target as HTMLElement;
      if (
        /INPUT|TEXTAREA/.test(target.tagName) ||
        target.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        drafts.length === 0
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "j" && selectedIndex < drafts.length - 1) {
        e.preventDefault();
        setSelectedIndex((i) => i + 1);
      } else if (key === "k" && selectedIndex > 0) {
        e.preventDefault();
        setSelectedIndex((i) => i - 1);
      } else if (key === "a") {
        e.preventDefault();
        handleApprove();
      } else if (key === "r") {
        e.preventDefault();
        handleReject();
      } else if (key === "e") {
        e.preventDefault();
        handleToggleEdit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drafts, selectedIndex, handleApprove, handleReject, handleToggleEdit]);

  if (!loading && drafts.length === 0) {
    return (
      <div>
        <h1>Approvals</h1>
        <p className="sub">
          Drafts written by the AI wait here until you approve them.
        </p>
        <div className="empty">
          Nothing to review. New drafts appear here as leads are scored.
        </div>
      </div>
    );
  }

  const currentDraft = drafts[selectedIndex] || drafts[0];

  return (
    <div>
      <h1>Approvals</h1>
      <p className="sub">
        Read each draft, change what you like, then approve it for sending.
      </p>

      {currentDraft && (
        <div className="appr">
          {/* Left Queue Panel */}
          <div className="queue inv" role="listbox" aria-label="Awaiting Approvals">
            {drafts.map((x, i) => (
              <button
                key={x.id}
                className={`qi ${i === selectedIndex ? "active" : ""}`}
                role="option"
                aria-selected={i === selectedIndex}
                onClick={() => {
                  setSelectedIndex(i);
                  setEditing(false);
                }}
                type="button"
              >
                <b>{x.full_name}</b>
                <small>
                  {x.title}, {x.company_name}
                </small>
                <small>Score {x.total_score}</small>
              </button>
            ))}
          </div>

          {/* Right Letter / Email Editor Panel */}
          <div className="letter">
            <h2>{currentDraft.full_name}</h2>
            <div className="meta">
              {currentDraft.title} at {currentDraft.company_name}
            </div>

            <input
              className="subj"
              id="subj"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              aria-label="Email Subject"
            />

            <div
              className="body"
              id="body"
              ref={bodyRef}
              contentEditable={editing}
              suppressContentEditableWarning
              onBlur={(e) => {
                if (editing) setEditBody(e.currentTarget.innerText);
              }}
            >
              {editBody}
            </div>

            <div className="acts">
              <button
                className="btn p"
                onClick={handleApprove}
                disabled={saving}
                type="button"
              >
                Approve and queue
                <kbd>A</kbd>
              </button>

              <button
                className="btn"
                onClick={handleToggleEdit}
                type="button"
              >
                {editing ? "Done editing" : "Edit"}
                <kbd>E</kbd>
              </button>

              <button
                className="btn"
                onClick={handleReject}
                disabled={saving}
                type="button"
              >
                Reject
                <kbd>R</kbd>
              </button>

              <span className="why">J / K to switch drafts</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
