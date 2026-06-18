'use client'

import type { BriefingRow as BriefingRowData } from './types'
import { MaterialityDot } from './MaterialityDot'
import { SourceTag } from './SourceTag'
import { Interpretation } from './Interpretation'
import { CitationBlock } from './CitationBlock'
import { scoreToBand } from '@/lib/home/materiality'

// A single briefing row: source tag + materiality dot + title + summary +
// (interpretation when a rationale exists) + citation. Client component because it
// reports focus upward for the per-view provenance pane.
const BAND_COLOR = {
  high: 'var(--mat-high)',
  elevated: 'var(--mat-elevated)',
  routine: 'var(--mat-routine)',
} as const

export function BriefingRow({
  briefing,
  focused = false,
  onFocus,
}: {
  briefing: BriefingRowData
  focused?: boolean
  onFocus?: () => void
}) {
  const band = scoreToBand(briefing.materialityScore)
  const interactive = !!onFocus

  return (
    <article
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onFocus}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onFocus?.()
              }
            }
          : undefined
      }
      style={{
        // Focused affordance uses only existing tokens: a signal-tint wash and a
        // signal left border (transparent when unfocused to avoid layout shift).
        background: focused ? 'var(--signal-tint)' : 'transparent',
        borderLeft: `2px solid ${focused ? 'var(--signal)' : 'transparent'}`,
        padding: '16px 20px',
        cursor: interactive ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <MaterialityDot score={briefing.materialityScore} />
        <span style={{ marginLeft: 10 }}>
          <SourceTag agency={briefing.agency} sourceType={briefing.sourceType} />
        </span>
        <span className="t-caption-emph" style={{ marginLeft: 'auto', color: BAND_COLOR[band] }}>
          {band}
          <span style={{ color: 'var(--ink-faint)' }}>
            {' · '}
            {briefing.materialityScore}
          </span>
        </span>
      </div>

      <h3 className="t-heading" style={{ margin: '0 0 10px' }}>
        {briefing.title}
      </h3>
      <p className={band === 'high' ? 't-body-emph' : 't-body'} style={{ margin: 0 }}>
        {briefing.summary}
      </p>

      {briefing.rationale ? <Interpretation text={briefing.rationale} /> : null}
      <CitationBlock
        title={briefing.title}
        url={briefing.url}
        publishedAt={briefing.publishedAt}
      />
    </article>
  )
}
