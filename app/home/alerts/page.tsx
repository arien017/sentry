export const dynamic = 'force-dynamic'

import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { BriefingRow, SourceType } from '@/components/home/types'
import { BriefingView } from '@/components/home/BriefingView'
import { ALERT_THRESHOLD } from '@/lib/home/materiality'

// Raw shape of the nested PostgREST embed — identical to the Today view. No generated
// DB types in this repo, so we type the result explicitly and normalize each to-one
// embed (object or single-element array) defensively.
interface RawSource {
  agency: string
}
interface RawPublication {
  title: string
  url: string | null
  published_at: string | null
  source_type: string
  sources: RawSource | RawSource[] | null
}
interface RawClassification {
  materiality_score: number
  rationale: string | null
  publications: RawPublication | RawPublication[] | null
}
interface RawBriefing {
  id: string
  summary: string
  created_at: string
  delivered_at: string | null
  classifications: RawClassification | RawClassification[] | null
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

function mapRows(raw: RawBriefing[]): BriefingRow[] {
  const out: BriefingRow[] = []
  for (const b of raw) {
    const cls = one(b.classifications)
    const pub = one(cls?.publications)
    const src = one(pub?.sources)
    if (!cls || !pub || !src) continue
    const sourceType: SourceType =
      pub.source_type === 'parliamentary' ? 'parliamentary' : 'regulator'
    out.push({
      id: b.id,
      summary: b.summary,
      createdAt: b.created_at,
      deliveredAt: b.delivered_at,
      materialityScore: cls.materiality_score,
      rationale: cls.rationale,
      title: pub.title,
      url: pub.url,
      publishedAt: pub.published_at,
      sourceType,
      agency: src.agency,
    })
  }
  return out
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div>
      <header style={{ padding: '20px 24px', borderBottom: '1px solid var(--hairline)' }}>
        <h1 className="t-title" style={{ margin: 0 }}>
          Alerts
        </h1>
      </header>
      {children}
    </div>
  )
}

export default async function AlertsPage() {
  const supabase = await createClient()

  // SAME nested select as Today — RLS scopes briefings/classifications to this firm;
  // publications/sources are authenticated-readable. No adminClient, no manual firm_id
  // filter. The only Alerts-specific difference is the materiality threshold, applied
  // in JS below (not a firm filter).
  const { data, error } = await supabase
    .from('briefings')
    .select(
      `
        id,
        summary,
        created_at,
        delivered_at,
        classifications!inner (
          materiality_score,
          rationale,
          publications!inner (
            title,
            url,
            published_at,
            source_type,
            sources!inner (
              agency
            )
          )
        )
      `
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Alerts: briefings query failed:', error)
    return (
      <Shell>
        <div style={{ padding: '40px 24px', maxWidth: 560 }}>
          <p className="t-body" style={{ color: 'var(--ink-mute)', margin: 0 }}>
            The briefings could not be loaded. The data service did not respond.
          </p>
        </div>
      </Shell>
    )
  }

  // Map exactly as Today, then apply the alert threshold in JS (guaranteed-correct;
  // the query is byte-identical to Today's). Sort materiality DESC, then recency DESC.
  const rows = mapRows((data ?? []) as unknown as RawBriefing[]).filter(
    (r) => r.materialityScore >= ALERT_THRESHOLD
  )
  rows.sort(
    (a, b) =>
      b.materialityScore - a.materialityScore || b.createdAt.localeCompare(a.createdAt)
  )

  if (rows.length === 0) {
    // Alerts-empty is a calm, GOOD state: briefings exist, none are high-materiality.
    // This is NOT Today's "no briefings filed" absence.
    return (
      <Shell>
        <div style={{ padding: '40px 24px', maxWidth: 560 }}>
          <h2 className="t-heading" style={{ margin: '0 0 8px' }}>
            No active alerts
          </h2>
          <p className="t-body" style={{ color: 'var(--ink-mute)', margin: 0 }}>
            No briefings have crossed the alert threshold. Lower-materiality items still
            appear in Today and Archive.
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <BriefingView briefings={rows} />
    </Shell>
  )
}
