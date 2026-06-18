import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { adminClient as supabaseAdmin } from '@/lib/supabase/admin'
import { LeftRail } from '@/components/home/LeftRail'

// Shell frame + auth gate for every /home/* view. Reuses the exact auth->firm
// pattern from the old placeholder page. The layout owns the rail and the children
// slot only — each view supplies its own centre+right (provenance) island, because
// the provenance pane is per-view client state.
export default async function HomeLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('firm_id')
    .eq('id', user.id)
    .maybeSingle()

  let firmName: string | null = null
  if (userRow?.firm_id) {
    const { data: firm } = await supabaseAdmin
      .from('firms')
      .select('name')
      .eq('id', userRow.firm_id)
      .maybeSingle()
    firmName = firm?.name ?? null
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        background: 'var(--ground)',
      }}
    >
      <aside
        style={{
          borderRight: '1px solid var(--hairline)',
          background: 'var(--ground-raised)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--hairline)' }}>
          <div className="t-caption-emph" style={{ color: 'var(--ink)' }}>
            {firmName ?? '—'}
          </div>
          <div
            className="t-caption"
            style={{
              color: 'var(--ink-faint)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user.email}
          </div>
        </div>
        <LeftRail />
      </aside>

      <main style={{ background: 'var(--ground)' }}>{children}</main>
    </div>
  )
}
