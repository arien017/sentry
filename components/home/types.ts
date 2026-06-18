// Row-shape types for the live home views — shaped to the actual DB join
// (briefings × classifications × publications × sources), NOT the marketing sample.

export type SourceType = 'regulator' | 'parliamentary'
export type MaterialityBand = 'high' | 'elevated' | 'routine' | 'acknowledged'

export interface BriefingRow {
  id: string
  summary: string
  createdAt: string // briefings.created_at (ISO)
  deliveredAt: string | null // briefings.delivered_at
  materialityScore: number // classifications.materiality_score (0–100 smallint)
  rationale: string | null // classifications.rationale
  title: string // publications.title
  url: string | null // publications.url
  publishedAt: string | null // publications.published_at
  sourceType: SourceType // publications.source_type
  agency: string // sources.agency  (the tag label, e.g. "APRA")
}
