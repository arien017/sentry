const regulators = [
  "APRA",
  "ASIC",
  "AUSTRAC",
  "TGA",
  "AER",
  "Federal Register of Legislation",
];

export default function RegulatorStrip() {
  return (
    <div className="mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-hairline pt-8 max-w-3xl">
      {regulators.map((name) => (
        <span key={name} className="font-display text-sm font-medium text-ink-mute">
          {name}
        </span>
      ))}
    </div>
  );
}