// "What this means for your firm" block — ported from Interpretation in
// MarketingSite.tsx, parameterised. Uses the existing .interp / .interp-label structure.
export function Interpretation({ text }: { text: string }) {
  return (
    <div className="interp">
      <span className="interp-label">What this means for your firm</span>
      <span className="t-body" style={{ color: 'var(--ink)' }}>
        {text}
      </span>
    </div>
  )
}
