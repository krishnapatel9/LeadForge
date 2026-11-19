"use client";

export default function PrivacyPage() {
  return (
    <div>
      <h1>Privacy Policy</h1>
      <p className="sub">Last updated: October 2026</p>

      <div style={{ maxWidth: "720px", display: "flex", flexDirection: "column", gap: "24px" }}>
        <section style={{ borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>Data Collection and Usage</h2>
          <p style={{ color: "var(--mute)", lineHeight: 1.6, margin: 0 }}>
            We collect information that you provide directly to us, including when you configure campaign ICPs or trigger lead enrichment. This includes work email, title, and public B2B firmographics sourced through integrations (Apollo, Clay).
          </p>
        </section>

        <section style={{ borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>AI Processing & Zero-Training Guarantees</h2>
          <p style={{ color: "var(--mute)", lineHeight: 1.6, margin: 0 }}>
            LeadForge utilizes API models (Anthropic Claude, Google Gemini) to synthesize research and draft outreach. Data processed through these APIs is subject to enterprise privacy agreements and is never used to train foundation models.
          </p>
        </section>

        <section style={{ borderTop: "1px solid var(--line)", paddingTop: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>Compliance & CAN-SPAM</h2>
          <p style={{ color: "var(--mute)", lineHeight: 1.6, margin: 0 }}>
            Every outreach draft enforces one-click unsubscribe links and physical address inclusion. When an unsubscribe or bounce occurs, the contact is permanently marked <code>do_not_contact</code> in our PostgreSQL database.
          </p>
        </section>
      </div>
    </div>
  );
}
