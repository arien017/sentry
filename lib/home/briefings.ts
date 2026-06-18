import type { createClient } from '@/lib/supabase/server'
import type { BriefingRow, SourceType } from '@/components/home/types'

// The awaited SSR server client the home views build with createClient(). Type-only
// import — erased at compile time, so this module carries no server-only runtime dep.
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Raw shape of the nested PostgREST embed. No generated DB types in this repo, so we
// type the result explicitly and normalize each to-one embed (which can come back as an
// object or a single-element array) defensively.
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

// The firm's briefings (RLS-scoped on the SSR client), fully sorted: materiality DESC,
// then recency DESC. Encapsulates the four-table nested select + one()/mapRows()
// normalization that Today/Alerts/Archive previously each duplicated. Throws on a query
// error so each caller can render its own error state.
export async function fetchBriefings(supabase: SupabaseServerClient): Promise<BriefingRow[]> {
  // FK inference: each embed pair has a single FK, so the plain table-name embed
  // resolves. If PostgREST ever errors on inference, use the explicit constraint hints:
  // classifications!briefings_classification_id_fkey,
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

  if (error) throw error

  const rows = mapRows((data ?? []) as unknown as RawBriefing[])
  rows.sort(
    (a, b) =>
      b.materialityScore - a.materialityScore || b.createdAt.localeCompare(a.createdAt)
  )
  return rows
}
