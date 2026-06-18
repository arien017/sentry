// Single source of truth for materiality thresholds used across the home views.
// PROVISIONAL — these bands and the alert threshold are first-pass and
// founder-confirmable; tune here and every view follows.

export const ALERT_THRESHOLD = 70
export const BAND_HIGH_MIN = 70
export const BAND_ELEVATED_MIN = 40

export function scoreToBand(score: number): 'high' | 'elevated' | 'routine' {
  if (score >= BAND_HIGH_MIN) return 'high'
  if (score >= BAND_ELEVATED_MIN) return 'elevated'
  return 'routine'
}
