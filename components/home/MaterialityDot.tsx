import { scoreToBand } from '@/lib/home/materiality'

// Presentational. Maps score -> band and renders the existing .mat-dot with the
// band class. `acknowledged` overrides the score and renders .mat-dot.acknowledged.
export function MaterialityDot({
  score,
  acknowledged = false,
}: {
  score: number
  acknowledged?: boolean
}) {
  const band = acknowledged ? 'acknowledged' : scoreToBand(score)
  return <span className={`mat-dot ${band}`} />
}
