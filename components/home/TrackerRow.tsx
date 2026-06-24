'use client'

import type { TrackerItem } from '@/lib/home/tracker-labels'
import { sourceTag, stageLabel, formatWhen } from '@/lib/home/tracker-labels'
import { MaterialityDot } from './MaterialityDot'

// One Tracker row: materiality dot + source tag + title + stage/date indicator + the
// one-line relevance note. Client component because it lifts focus to the page for the
// provenance pane. Imports only pure-UI helpers (tracker-labels) and the presentational
// MaterialityDot — no server-fetch module.
export function TrackerRow({
  item,
  focused,
  onFocus,
}: {
  item: TrackerItem
  focused: boolean
  onFocus: () => void
}) {
  const when = formatWhen(item)
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onFocus}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onFocus()
        }
      }}
      style={{
        // Focused affordance uses only existing tokens: a signal-tint wash + signal left
        // border (transparent when unfocused to avoid layout shift).
        background: focused ? 'var(--signal-tint)' : 'transparent',
        borderLeft: `2px solid ${focused ? 'var(--signal)' : 'transparent'}`,
        padding: '16px 20px',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <MaterialityDot score={item.materialityScore} />
        <span className="t-caption-emph">{sourceTag(item)}</span>
        <span className="t-caption-emph" style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>
          {stageLabel(item.stage)}
          {when ? ` · ${when}` : ''}
        </span>
      </div>

      <h3 className="t-heading" style={{ margin: '0 0 6px' }}>
        {item.title}
      </h3>
      {item.relevance ? (
        <p className="t-body" style={{ margin: 0, color: 'var(--ink-mute)' }}>
          {item.relevance}
        </p>
      ) : null}
    </article>
  )
}
