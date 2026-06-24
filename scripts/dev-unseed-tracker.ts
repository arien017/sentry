/**
 * DEV UNSEED — deletes the synthetic tracker_items written by dev-seed-tracker.ts.
 *
 * RUN BY HAND with the service-role key (read from env; never printed):
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/dev-unseed-tracker.ts <firm_id>
 *
 *   <firm_id> is REQUIRED (a UUID). No default; will not run blind.
 *
 * Deletes ONLY this firm's synthetic tracker rows, by marker (firm-scoped):
 *   tracker_items where firm_id = <firm_id>
 *                 AND url LIKE 'https://seed.local/tracker/%'
 *                 AND detail->>'provenance' = 'dev-seed-tracker'
 */
import { createClient } from '@supabase/supabase-js'

const TRACKER_PROVENANCE = 'dev-seed-tracker'
const SEED_URL_PREFIX = 'https://seed.local/tracker/'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const firmId = process.argv[2]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!firmId || !UUID_RE.test(firmId)) {
  console.error('Usage: npx tsx scripts/dev-unseed-tracker.ts <firm_id>')
  console.error('  <firm_id> is required and must be a UUID. No default; will not run blind.')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main(): Promise<void> {
  console.log(`Unseeding synthetic tracker_items for firm ${firmId} …`)

  const del = await supabase
    .from('tracker_items')
    .delete()
    .eq('firm_id', firmId)
    .like('url', `${SEED_URL_PREFIX}%`)
    .eq('detail->>provenance', TRACKER_PROVENANCE)
    .select('id')
  if (del.error) throw new Error(`tracker_items delete failed: ${del.error.message}`)

  console.log(`Done. Deleted ${del.data?.length ?? 0} tracker_items.`)
}

main().catch((err) => {
  console.error('Unseed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
