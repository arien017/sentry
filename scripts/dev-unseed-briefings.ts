/**
 * DEV UNSEED — deletes the synthetic briefing chain written by dev-seed-briefings.ts.
 *
 * RUN BY HAND with the service-role key (read from env; never printed):
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/dev-unseed-briefings.ts <firm_id>
 *
 *   <firm_id> is REQUIRED (a UUID). No default; will not run blind.
 *
 * Deletes, scoped to <firm_id> and FK-safe (briefings → classifications → publications):
 *   - briefings whose classification is the firm's synthetic ('dev-seed') classification
 *   - classifications where firm_id = <firm_id> AND model_version = 'dev-seed'
 *   - publications whose url starts with `https://seed.local/<firm_id>/`
 * Sources are reused real rows and are NOT touched.
 *
 * The firm PROFILE is intentionally LEFT INTACT (it is firm-correct, not throwaway).
 * To also reset it to the empty stub, run by hand:
 *   update firm_profiles set attributes = '{}'::jsonb where firm_id = '<firm_id>';
 */
import { createClient } from '@supabase/supabase-js'

const SEED_MODEL_VERSION = 'dev-seed'
const seedUrlPrefix = (firmId: string) => `https://seed.local/${firmId}/`

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const firmId = process.argv[2]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!firmId || !UUID_RE.test(firmId)) {
  console.error('Usage: npx tsx scripts/dev-unseed-briefings.ts <firm_id>')
  console.error('  <firm_id> is required and must be a UUID. No default; will not run blind.')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main(): Promise<void> {
  console.log(`Unseeding synthetic briefings for firm ${firmId} …`)

  const { data: cls, error: clsErr } = await supabase
    .from('classifications')
    .select('id')
    .eq('firm_id', firmId)
    .eq('model_version', SEED_MODEL_VERSION)
  if (clsErr) throw new Error(`classifications lookup failed: ${clsErr.message}`)
  const clsIds = (cls ?? []).map((c) => (c as { id: string }).id)

  let briefingsDeleted = 0
  let classificationsDeleted = 0
  if (clsIds.length > 0) {
    const b = await supabase
      .from('briefings')
      .delete()
      .eq('firm_id', firmId)
      .in('classification_id', clsIds)
      .select('id')
    if (b.error) throw new Error(`briefings delete failed: ${b.error.message}`)
    briefingsDeleted = b.data?.length ?? 0

    const c = await supabase
      .from('classifications')
      .delete()
      .eq('firm_id', firmId)
      .in('id', clsIds)
      .select('id')
    if (c.error) throw new Error(`classifications delete failed: ${c.error.message}`)
    classificationsDeleted = c.data?.length ?? 0
  }

  const p = await supabase
    .from('publications')
    .delete()
    .like('url', `${seedUrlPrefix(firmId)}%`)
    .select('id')
  if (p.error) throw new Error(`publications delete failed: ${p.error.message}`)
  const publicationsDeleted = p.data?.length ?? 0

  console.log(
    `Done. Deleted ${briefingsDeleted} briefings, ${classificationsDeleted} classifications, ${publicationsDeleted} publications.`
  )
  console.log('Firm profile left intact (firm-correct). Reset it by hand if desired (see header).')
}

main().catch((err) => {
  console.error('Unseed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
