"use client";

export default function FAQPage() {
  const faqs = [
    {
      q: "How is the score worked out?",
      a: "Each lead gets a score out of 100 from five parts: fit (company profile), intent (buying signals), contactability, gaps in their current setup, and engagement. Data from Apollo and Clay is compared with your campaign targets, with no AI guesswork in the number.",
    },
    {
      q: "When does the AI start researching a lead?",
      a: "Once a lead clears the minimum score from the first firmographic check. The AI then reads the company’s recent news, tech stack and LinkedIn presence.",
    },
    {
      q: "Can I change an email before it sends?",
      a: "Yes. Every AI draft waits in Approvals. Edit it, approve it, and only then is it queued to send.",
    },
    {
      q: "How does deduplication work?",
      a: "FastAPI checks company domain and lead email against existing records in PostgreSQL. Records contacted within 90 days are skipped to protect domain reputation and prevent spam.",
    },
    {
      q: "What happens when a prospect replies?",
      a: "Inbound webhook callbacks immediately halt any scheduled automated follow-up steps and advance the lead stage to 'Replied' so an Account Executive can engage directly.",
    },
  ];

  return (
    <div>
      <h1>Help</h1>
      <p className="sub">How scoring, research and approvals work.</p>

      {faqs.map((faq, i) => (
        <details
          key={faq.q}
          className={i % 2 === 1 ? "inv" : ""}
          open={i === 0 ? true : undefined}
        >
          <summary>{faq.q}</summary>
          <p>{faq.a}</p>
        </details>
      ))}
    </div>
  );
}
