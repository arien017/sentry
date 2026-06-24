'use client'

import { useState } from 'react'
import type { BandGroup } from '@/lib/home/tracker-labels'
import { sourceTag, stageLabel, formatWhen } from '@/lib/home/tracker-labels'
import { TrackerRow } from './TrackerRow'

// Client island for the Tracker: owns the focused-item id, renders the centre band groups
// and the right provenance pane. Receives the pre-grouped, server-fetched items as props
// (plain serializable objects) — it fetches nothing and knows no firm_id. Mirrors how
// BriefingView supplies the [centre | provenance] island the layout does not own.
export function TrackerView({ groups }: { groups: BandGroup[] }) {
  const allItems = groups.flatMap((g) => g.items)
  const [focusedId, setFocusedId] = useState<string | null>(allItems[0]?.id ?? null)
  const focused = allItems.find((i) => i.id === focusedId) ?? null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px' }}>
      {/* Centre: the five band groups, in order; empty bands are already omitted upstream. */}
      <div style={{ borderRight: '1px solid var(--hairline)' }}>
        {groups.map((g) => (
          <section key={g.band}>
            <div
              className="t-caption-emph"
              style={{
                padding: '16px 20px 8px',
                color: 'var(--ink-mute)',
                borderBottom: '1px solid var(--hairline)',
              }}
            >
              {g.band}
            </div>
            {g.items.map((it) => (
              <div key={it.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <TrackerRow
                  item={it}
                  focused={it.id === focusedId}
                  onFocus={() => setFocusedId(it.id)}
                />
              </div>
            ))}
          </section>
        ))}
      </div>

      {/* Right: provenance for the focused item. Sticky so a long centre list doesn't
          push it off-screen. */}
      <aside style={{ position: 'sticky', top: 0, alignSelf: 'start', padding: 24 }}>
        {focused ? (
          <>
            <div className="t-caption-emph" style={{ color: 'var(--ink-mute)', marginBottom: 12 }}>
              Provenance
            </div>

            <div style={{ marginBottom: 8 }}>
              <span className="t-caption-emph">{sourceTag(focused)}</span>
            </div>

            <h2 className="t-heading" style={{ margin: '0 0 8px' }}>
              {focused.title}
            </h2>

            <div className="t-caption" style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
              {stageLabel(focused.stage)}
              {formatWhen(focused) ? ` · ${formatWhen(focused)}` : ''}
            </div>

            <div className="citation">
              {focused.url ? (
                <a href={focused.url} target="_blank" rel="noopener noreferrer">
                  View source document
                </a>
              ) : (
                <span style={{ color: 'var(--ink-faint)' }}>Source link unavailable</span>
              )}
            </div>

            {focused.relevance ? (
              <div className="interp" style={{ marginTop: 16 }}>
                <span className="interp-label">Why this matters</span>
                <span className="t-body" style={{ color: 'var(--ink)' }}>
                  {focused.relevance}
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <div className="t-caption" style={{ color: 'var(--ink-faint)' }}>
            Select an item
          </div>
        )}
      </aside>
    </div>
  )
}
