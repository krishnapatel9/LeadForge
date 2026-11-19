"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { trackEvent } from "../../lib/analytics";

export interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [prefs, setPrefs] = useState<CookiePreferences>({
    essential: true,
    analytics: true,
    marketing: false,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("leadforge_cookie_consent");
      if (!stored) {
        const timer = setTimeout(() => setIsVisible(true), 1000);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore
    }
  }, []);

  const saveConsent = (preferences: CookiePreferences) => {
    try {
      localStorage.setItem(
        "leadforge_cookie_consent",
        JSON.stringify({ ...preferences, timestamp: new Date().toISOString() })
      );
      setIsVisible(false);
      setShowPreferences(false);
      trackEvent("cookie_consent_updated", {
        analytics: preferences.analytics,
        marketing: preferences.marketing,
      });
    } catch {
      // Ignore
    }
  };

  const handleAcceptAll = () => {
    const allOn: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true,
    };
    setPrefs(allOn);
    saveConsent(allOn);
  };

  const handleDeclineOptional = () => {
    const essentialOnly: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
    };
    setPrefs(essentialOnly);
    saveConsent(essentialOnly);
  };

  const handleSaveCustom = () => {
    saveConsent(prefs);
  };

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent banner"
      className="inv"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: "16px 24px",
        borderTop: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          maxWidth: "1080px",
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
        }}
      >
        <div style={{ flex: 1, minWidth: "260px" }}>
          <strong style={{ display: "block", fontSize: "14px", marginBottom: "2px" }}>
            Privacy & Cookie Preferences
          </strong>
          <p style={{ fontSize: "13px", color: "var(--mute)", margin: 0, maxWidth: "60ch" }}>
            LeadForge stores essential session state and optional telemetry to improve research
            workflows. Read our{" "}
            <Link href="/privacy" style={{ color: "var(--ink)", textDecoration: "underline" }}>
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() => setShowPreferences(!showPreferences)}
            className="btn"
            style={{ fontSize: "12px", padding: "6px 12px" }}
            type="button"
          >
            Preferences
          </button>
          <button
            onClick={handleDeclineOptional}
            className="btn"
            style={{ fontSize: "12px", padding: "6px 12px" }}
            type="button"
          >
            Decline
          </button>
          <button
            onClick={handleAcceptAll}
            className="btn p"
            style={{ fontSize: "12px", padding: "6px 14px" }}
            type="button"
          >
            Accept All
          </button>
        </div>
      </div>

      {showPreferences && (
        <div
          style={{
            maxWidth: "1080px",
            margin: "14px auto 0",
            paddingTop: "14px",
            borderTop: "1px solid var(--line)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
            fontSize: "12px",
          }}
        >
          <div style={{ border: "1px solid var(--line)", padding: "10px" }}>
            <strong>Essential</strong>
            <span style={{ float: "right", color: "var(--mute)" }}>Always On</span>
            <p style={{ color: "var(--mute)", margin: "4px 0 0" }}>
              Required for auth tokens and core routing.
            </p>
          </div>

          <div style={{ border: "1px solid var(--line)", padding: "10px" }}>
            <label style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
              <strong>Analytics</strong>
              <input
                type="checkbox"
                checked={prefs.analytics}
                onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })}
              />
            </label>
            <p style={{ color: "var(--mute)", margin: "4px 0 0" }}>
              Anonymous usage to tune prompt performance.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={handleSaveCustom}
              className="btn p"
              style={{ width: "100%", fontSize: "12px" }}
              type="button"
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
