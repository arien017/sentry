import RegulatorStrip from "@/component/RegulatorStrip";

export default function Hero() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center text-center py-24">
      <h1 className="font-display text-4xl font-medium tracking-tight text-ink max-w-2xl">
        Regulatory monitoring for risk, legal, and compliance teams.
      </h1>
      <p className="mt-4 text-ink-mute max-w-md">
        Six regulators. Daily intelligence. Five hundred dollars a month.
      </p>
      <button className="mt-8 rounded bg-signal px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-signal-hover">
        Start the conversation
      </button>

      <RegulatorStrip />
    </section>
  );
}