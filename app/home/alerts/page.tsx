export const dynamic = 'force-dynamic'

import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { BriefingRow } from '@/components/home/types'
import { BriefingView } from '@/components/home/BriefingView'
import { fetchBriefings } from '@/lib/home/briefings'
import { ALERT_THRESHOLD } from '@/lib/home/materiality'

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

  // Shared fetch returns the firm's briefings already sorted (materiality DESC, recency
  // DESC). Alerts keeps only the high-materiality subset; the filter preserves order, so
  // no re-sort is needed. The threshold is a materiality filter, not a firm filter.
  let all: BriefingRow[]
  try {
    all = await fetchBriefings(supabase)
  } catch (error) {
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

  const rows = all.filter((r) => r.materialityScore >= ALERT_THRESHOLD)

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
