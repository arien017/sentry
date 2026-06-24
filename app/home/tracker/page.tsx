export const dynamic = 'force-dynamic'

import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { fetchTrackerItems, groupByBand } from '@/lib/home/tracker'
import type { TrackerItem } from '@/lib/home/tracker'
import { TrackerView } from '@/components/home/TrackerView'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div>
      <header style={{ padding: '20px 24px', borderBottom: '1px solid var(--hairline)' }}>
        <h1 className="t-title" style={{ margin: 0 }}>
          Tracker
        </h1>
      </header>
      {children}
    </div>
  )
}

export default async function TrackerPage() {
  const supabase = await createClient()

  // RLS (firm_id = auth_firm_id()) scopes tracker_items to this user's firm; no firm_id is
  // passed or accepted from the client.
  let items: TrackerItem[]
  try {
    items = await fetchTrackerItems(supabase)
  } catch (error) {
    console.error('Tracker: query failed:', error)
    return (
      <Shell>
        <div style={{ padding: '40px 24px', maxWidth: 560 }}>
          <p className="t-body" style={{ color: 'var(--ink-mute)', margin: 0 }}>
            The tracker could not be loaded. The data service did not respond.
          </p>
        </div>
      </Shell>
    )
  }

  if (items.length === 0) {
    return (
      <Shell>
        <div style={{ padding: '40px 24px', maxWidth: 560 }}>
          <h2 className="t-heading" style={{ margin: '0 0 8px' }}>
            Nothing on the horizon
          </h2>
          <p className="t-body" style={{ color: 'var(--ink-mute)', margin: 0 }}>
            No bills, inquiries, consultations, or instruments are currently tracked for your
            firm. Items appear here as they are identified across the regulators and Parliament
            you monitor.
          </p>
        </div>
      </Shell>
    )
  }

  // Group into bands once per request (bandOf uses a single local-midnight "today").
  const groups = groupByBand(items)

  return (
    <Shell>
      <TrackerView groups={groups} />
    </Shell>
  )
}
