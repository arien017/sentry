export const dynamic = 'force-dynamic'

import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { BriefingRow } from '@/components/home/types'
import { BriefingView } from '@/components/home/BriefingView'
import { fetchBriefings } from '@/lib/home/briefings'

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

  // RLS scopes briefings/classifications to this firm on the SSR client. The shared
  // fetchBriefings returns the firm's briefings fully sorted (materiality DESC, then
  // recency DESC); it throws on a query error, which we render below.
  let rows: BriefingRow[]
  try {
    rows = await fetchBriefings(supabase)
  } catch (error) {
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
