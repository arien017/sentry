export const dynamic = 'force-dynamic'

import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { BriefingRow } from '@/components/home/types'
import { BriefingView } from '@/components/home/BriefingView'
import { ArchiveSearch } from '@/components/home/ArchiveSearch'
import { fetchBriefings } from '@/lib/home/briefings'

const PAGE_SIZE = 20

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

  // Shared fetch returns the firm's full briefing set already sorted (materiality DESC,
  // recency DESC). Search + pagination run on the result below.
  // SCALE NOTE: this fetches the firm's FULL briefing set, then filters/paginates in JS.
  // Correct for the current data, but at a large archive this must move to a DB-side
  // full-text search (tsvector/websearch over summary+title, or an RPC) + DB .range()
  // pagination, so the server doesn't fetch-all-to-filter.
  let all: BriefingRow[]
  try {
    all = await fetchBriefings(supabase)
  } catch (error) {
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

  // Search matches BOTH summary and title, case-insensitive. The shared fetch already
  // sorted; the filter preserves order, so no re-sort is needed.
  const ql = q.toLowerCase()
  const filtered = q
    ? all.filter(
        (r) =>
          r.summary.toLowerCase().includes(ql) || r.title.toLowerCase().includes(ql)
      )
    : all

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
