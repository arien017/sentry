const surfaces = [
  {
    label: "Daily digest",
    heading: "Every morning at seven",
    body: "A digest of what your regulators published in the last twenty-four hours, ordered by materiality to your firm. If nothing material happened, it says so plainly and looks ahead to the week's publication windows.",
  },
  {
    label: "Real-time alert",
    heading: "Within fifteen minutes",
    body: "When a regulator publishes something material to your firm, an alert reaches your inbox within fifteen minutes. The subject line carries the regulator, the publication, and what it means for you.",
  },
  {
    label: "Agentic home",
    heading: "Ask and trace",
    body: "Ask questions about any regulatory development and read every briefing in full, traced back to the regulator's published source. The archive holds your firm's complete monitoring history.",
  },
];

export default function HowItWorks() {
  return (
    <section className="w-full max-w-5xl border-t border-hairline py-20">
      <div className="grid gap-12 md:grid-cols-3">
        {surfaces.map((surface) => (
          <div key={surface.label}>
            <div className="text-xs font-medium uppercase tracking-widest text-ink-mute">
              {surface.label}
            </div>
            <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-ink">
              {surface.heading}
            </h2>
            <p className="mt-3 text-ink-mute">{surface.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}