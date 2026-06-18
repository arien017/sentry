export const dynamic = 'force-dynamic'

import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { BriefingRow, SourceType } from '@/components/home/types'
import { BriefingView } from '@/components/home/BriefingView'
import { ArchiveSearch } from '@/components/home/ArchiveSearch'

const PAGE_SIZE = 20

// Raw shape of the nested PostgREST embed — identical to Today/Alerts. No generated DB
// types in this repo, so we type the result explicitly and normalize each to-one embed
// (object or single-element array) defensively.
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

function Shell({ search, children }: { search?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <header style={{ padding: '20px 24px', borderBottom: '1px solid var(--hairline)' }}>
        <h1 className="t-title" style={{ margin: search ? '0 0 12px' : 0 }}>
          Archive
        </h1>
        {search ? <Suspense fallback={null}>{search}</Suspense> : null}
      </header>
      {children}
    </div>
  )
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q: qParam, page: pageParam } = await searchParams
  const q = (qParam ?? '').trim()

  const rawPage = parseInt(pageParam ?? '1', 10)
  let page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage

  const supabase = await createClient()

  // SAME nested select as Today/Alerts — RLS scopes briefings/classifications to this
  // firm; publications/sources are authenticated-readable. No adminClient, no manual
  // firm_id filter.
  // SCALE NOTE: this fetches the firm's FULL briefing set, then filters/sorts/paginates
  // in JS. Correct for the current data, but at a large archive this must move to a
  // DB-side full-text search (tsvector/websearch over summary+title, or an RPC) + DB
  // .range() pagination, so the server doesn't fetch-all-to-filter.
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
    console.error('Archive: briefings query failed:', error)
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

  const all = mapRows((data ?? []) as unknown as RawBriefing[])

  // Search matches BOTH summary and title, case-insensitive (JS, across both fields).
  const ql = q.toLowerCase()
  const filtered = q
    ? all.filter(
        (r) =>
          r.summary.toLowerCase().includes(ql) || r.title.toLowerCase().includes(ql)
      )
    : all

  // Same sort as Today/Alerts: materiality DESC, then recency DESC — before paginating.
  filtered.sort(
    (a, b) =>
      b.materialityScore - a.materialityScore || b.createdAt.localeCompare(a.createdAt)
  )

  const totalMatched = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalMatched / PAGE_SIZE))
  if (page > totalPages) page = totalPages
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Empty: firm has no briefings at all (no query, zero rows). Today-style absence.
  if (totalMatched === 0 && !q) {
    return (
      <Shell>
        <div style={{ padding: '40px 24px', maxWidth: 560 }}>
          <h2 className="t-heading" style={{ margin: '0 0 8px' }}>
            Nothing filed yet
          </h2>
          <p className="t-body" style={{ color: 'var(--ink-mute)', margin: 0 }}>
            No briefings have been filed for your firm yet. As regulators and Parliament
            publish, the firm&apos;s briefing history will build here.
          </p>
        </div>
      </Shell>
    )
  }

  // Empty: a search matched nothing. Different state — briefings exist, query missed.
  if (totalMatched === 0) {
    return (
      <Shell search={<ArchiveSearch />}>
        <div style={{ padding: '40px 24px', maxWidth: 560 }}>
          <h2 className="t-heading" style={{ margin: '0 0 8px' }}>
            No matches
          </h2>
          <p className="t-body" style={{ color: 'var(--ink-mute)', margin: 0 }}>
            {`No briefings match "${q}". Clear the search to see all briefings.`}
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell search={<ArchiveSearch />}>
      <BriefingView briefings={pageRows} />

      {totalPages > 1 ? (
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '16px 24px',
            borderTop: '1px solid var(--hairline)',
          }}
        >
          {page > 1 ? (
            <Link
              href={`/home/archive?q=${encodeURIComponent(q)}&page=${page - 1}`}
              className="t-caption-emph"
              style={{ color: 'var(--signal)' }}
            >
              Prev
            </Link>
          ) : (
            <span className="t-caption-emph" style={{ color: 'var(--ink-faint)' }}>
              Prev
            </span>
          )}

          <span className="t-caption" style={{ color: 'var(--ink-mute)' }}>
            Page {page} of {totalPages}
          </span>

          {page < totalPages ? (
            <Link
              href={`/home/archive?q=${encodeURIComponent(q)}&page=${page + 1}`}
              className="t-caption-emph"
              style={{ color: 'var(--signal)' }}
            >
              Next
            </Link>
          ) : (
            <span className="t-caption-emph" style={{ color: 'var(--ink-faint)' }}>
              Next
            </span>
          )}
        </nav>
      ) : null}
    </Shell>
  )
}
