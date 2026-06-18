export const dynamic = 'force-dynamic'

import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { BriefingRow, SourceType } from '@/components/home/types'
import { BriefingView } from '@/components/home/BriefingView'

// Raw shape of the nested PostgREST embed. There are no generated DB types in this
// repo, so we type the result explicitly and normalize each to-one embed (which can
// come back as an object or a single-element array) defensively.
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
    // !inner + NOT NULL FKs make missing pieces unreachable; guard defensively.
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
          Today
        </h1>
      </header>
      {children}
    </div>
  )
}

export default async function TodayPage() {
  const supabase = await createClient()

  // SSR (anon) client — RLS scopes briefings/classifications to this firm
  // automatically; publications/sources are authenticated-readable. No adminClient,
  // no manual firm_id filter.
  // FK inference: each embed pair has a single FK, so the plain table-name embed
  // resolves. If PostgREST ever errors on inference, use the explicit constraint
  // hints: classifications!briefings_classification_id_fkey,
  // publications!classifications_publication_id_fkey, sources!publications_source_id_fkey.
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
    console.error('Today: briefings query failed:', error)
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

  const rows = mapRows((data ?? []) as unknown as RawBriefing[])
  // DB .order only sorted by created_at; the primary sort is materiality DESC, then
  // recency DESC. Done in JS after mapping (only a handful of rows).
  rows.sort(
    (a, b) =>
      b.materialityScore - a.materialityScore || b.createdAt.localeCompare(a.createdAt)
  )

  if (rows.length === 0) {
    return (
      <Shell>
        <div style={{ padding: '40px 24px', maxWidth: 560 }}>
          <h2 className="t-heading" style={{ margin: '0 0 8px' }}>
            Nothing today
          </h2>
          <p className="t-body" style={{ color: 'var(--ink-mute)', margin: 0 }}>
            No briefings have been filed for your firm yet. When a regulator or
            parliamentary item crosses your materiality threshold, it will appear here.
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
