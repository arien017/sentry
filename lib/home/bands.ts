// Pure UI: score-band → CSS colour token for the materiality label. No server imports,
// so this is safe to import from client components. Keyed by scoreToBand()'s output
// ('high' | 'elevated' | 'routine'); the band cuts themselves live in materiality.ts.
export const BAND_COLOR = {
  high: 'var(--mat-high)',
  elevated: 'var(--mat-elevated)',
  routine: 'var(--mat-routine)',
} as const
