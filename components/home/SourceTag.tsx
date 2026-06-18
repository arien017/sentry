import type { SourceType } from './types'

// The source/regulator tag — literally the .t-caption-emph class (uppercase caption),
// mirroring TagRow's tag in MarketingSite.tsx. Parliamentary items are prefixed.
export function SourceTag({
  agency,
  sourceType,
}: {
  agency: string
  sourceType: SourceType
}) {
  const label = sourceType === 'parliamentary' ? `PARLIAMENT · ${agency}` : agency
  return <span className="t-caption-emph">{label}</span>
}
