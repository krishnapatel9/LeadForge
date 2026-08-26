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
    essential: true, // Always required
    analytics: true,
    marketing: false,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("leadforge_cookie_consent");
      if (!stored) {
        // Show banner after brief delay
        const timer = setTimeout(() => setIsVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.debug("Error checking cookie consent:", e);
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
    } catch (e) {
      console.debug("Error saving cookie preferences:", e);
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
      className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6 bg-slate-900/95 backdrop-blur border-t border-slate-800 text-slate-100 shadow-2xl transition-all"
    >
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1 pr-4">
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <svg
              className="w-4 h-4 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Privacy & Data Transparency
          </h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            LeadForge uses essential cookies to preserve operational session state and optional telemetry to improve lead research workflows. We do not sell your personal data. Read our{" "}
            <Link
              href="/privacy"
              className="underline text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              href="/terms"
              className="underline text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Terms of Service
            </Link>
            .
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto">
          <button
            onClick={() => setShowPreferences(!showPreferences)}
            className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            Preferences
          </button>
          <button
            onClick={handleDeclineOptional}
            className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            Decline Optional
          </button>
          <button
            onClick={handleAcceptAll}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>

      {/* Preferences Modal / Accordion */}
      {showPreferences && (
        <div className="mt-4 pt-4 border-t border-slate-800 max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-200">Essential (Required)</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Always On</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Necessary for user authentication, API token routing, and core app operation.
            </p>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="pref-analytics" className="font-bold text-slate-200 cursor-pointer">
                Telemetry & Analytics
              </label>
              <input
                id="pref-analytics"
                type="checkbox"
                checked={prefs.analytics}
                onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })}
                className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 h-4 w-4 bg-slate-700 cursor-pointer"
              />
            </div>
            <p className="text-slate-400 text-[11px]">
              Anonymous metrics on dashboard usage to optimize lead scoring performance.
            </p>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="pref-marketing" className="font-bold text-slate-200 cursor-pointer">
                Product Updates
              </label>
              <input
                id="pref-marketing"
                type="checkbox"
                checked={prefs.marketing}
                onChange={(e) => setPrefs({ ...prefs, marketing: e.target.checked })}
                className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 h-4 w-4 bg-slate-700 cursor-pointer"
              />
            </div>
            <p className="text-slate-400 text-[11px]">
              Allows us to notify you of major model prompt updates and integrations.
            </p>
          </div>

          <div className="sm:col-span-3 flex justify-end">
            <button
              onClick={handleSaveCustom}
              className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors"
            >
              Save Cookie Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
