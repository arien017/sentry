'use client'

import { useState } from 'react'
import type { BriefingRow } from './types'
import { BriefingRow as BriefingRowItem } from './BriefingRow'
import { SourceTag } from './SourceTag'

// Generalised list+provenance island (named BriefingView, not TodayView, so Alerts and
// Archive can reuse it — its only prop is `briefings`; the page owns the query/filter).
// This is the island that supplies the right provenance pane the layout intentionally
// does NOT own (provenance depends on per-view focused-briefing client state).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Deterministic UTC formatting — avoids a server/client hydration mismatch.
function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function BriefingView({ briefings }: { briefings: BriefingRow[] }) {
  // Default focus to the first row so the provenance pane is populated on load.
  const [focusedId, setFocusedId] = useState<string | null>(briefings[0]?.id ?? null)
  const focused = briefings.find((b) => b.id === focusedId) ?? null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px' }}>
      {/* Centre: the briefing list */}
      <div style={{ borderRight: '1px solid var(--hairline)' }}>
        {briefings.map((b) => (
          <div key={b.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
            <BriefingRowItem
              briefing={b}
              focused={b.id === focusedId}
              onFocus={() => setFocusedId(b.id)}
            />
          </div>
        ))}
      </div>

      {/* Right: provenance pane for the focused briefing. Sticky so a long centre
          list doesn't push it off-screen. */}
      <aside style={{ position: 'sticky', top: 0, alignSelf: 'start', padding: 24 }}>
        {focused ? (
          <>
            <div
              className="t-caption-emph"
              style={{ color: 'var(--ink-mute)', marginBottom: 12 }}
            >
              Provenance
            </div>

            <div style={{ marginBottom: 8 }}>
              <SourceTag agency={focused.agency} sourceType={focused.sourceType} />
            </div>

            <h2 className="t-heading" style={{ margin: '0 0 8px' }}>
              {focused.title}
            </h2>

            {focused.publishedAt ? (
              <div className="t-caption" style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
                Published {fmtDate(focused.publishedAt)}
              </div>
            ) : null}

            <div className="citation">
              {focused.url ? (
                <a href={focused.url} target="_blank" rel="noopener noreferrer">
                  View source document
                </a>
              ) : (
                <span style={{ color: 'var(--ink-faint)' }}>Source link unavailable</span>
              )}
            </div>

            {focused.rationale ? (
              <div className="interp" style={{ marginTop: 16 }}>
                <span className="interp-label">Why this matters</span>
                <span className="t-body" style={{ color: 'var(--ink)' }}>
                  {focused.rationale}
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <div className="t-caption" style={{ color: 'var(--ink-faint)' }}>
            Select a briefing
          </div>
        )}
      </aside>
    </div>
  )
}
