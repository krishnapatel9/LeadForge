/**
 * Privacy-friendly Analytics and Telemetry Utility for LeadForge
 * Provides structured client-side tracking with zero personal data leakage.
 */

type AnalyticsEvent =
  | "lead_approved"
  | "lead_rejected"
  | "lead_researched"
  | "campaign_created"
  | "campaign_toggled"
  | "filter_applied"
  | "search_query"
  | "connection_tested"
  | "cookie_consent_updated"
  | "faq_searched";

interface EventPayload {
  [key: string]: string | number | boolean | undefined;
}

export function trackEvent(eventName: AnalyticsEvent, payload?: EventPayload): void {
  try {
    if (typeof window === "undefined") return;

    // Check if user has opted into analytics cookies
    const consent = localStorage.getItem("leadforge_cookie_consent");
    if (consent) {
      const parsed = JSON.parse(consent);
      if (!parsed.analytics) {
        // Analytics disabled by user
        return;
      }
    }

    // Dispatch event to window telemetry / external analytics (GA4, Plausible, PostHog)
    const customEvent = new CustomEvent("leadforge:telemetry", {
      detail: {
        event: eventName,
        payload,
        timestamp: new Date().toISOString(),
      },
    });
    window.dispatchEvent(customEvent);

    // Optional Plausible hook
    if (typeof (window as any).plausible === "function") {
      (window as any).plausible(eventName, { props: payload });
    }

    // Optional GA4 hook
    if (typeof (window as any).gtag === "function") {
      (window as any).gtag("event", eventName, payload);
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`[LeadForge Telemetry] ${eventName}`, payload ?? {});
    }
  } catch (err) {
    // Fail silently to avoid breaking UX
    console.debug("Telemetry error:", err);
  }
}

export function trackPageView(url: string): void {
  try {
    if (typeof window === "undefined") return;
    trackEvent("search_query", { page: url });
  } catch (err) {
    console.debug("Pageview tracking error:", err);
  }
}
