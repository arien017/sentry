/**
 * DEV SEED: synthetic Tracker fixture rows (public.tracker_items) for one firm, for
 * local Tracker-view development. Same family as dev-seed-briefings.ts.
 *
 * RUN BY HAND with the service-role key (read from env; never printed):
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/dev-seed-tracker.ts <firm_id>
 *
 *   <firm_id> is REQUIRED (a UUID). No default; the script will not run blind.
 *   DELOITTE is fe739d35-7c79-47a9-9c5a-2f8ba43702b8.
 *
 * WHAT IT DOES: inserts 11 hand-authored tracker_items scoped to <firm_id>, spanning all
 * five Tracker bands (Before Parliament / In Progress / Closing Soon / Sunsetting /
 * Closed). All dates are computed relative to today, so the fixture stays forward-dated
 * whenever it is run. HAND-AUTHORED fixtures: they validate the view's rendering only.
 *
 * SYNTHETIC MARKER (identifiable + cleanly deletable, firm-scoped):
 *   - url                   = https://seed.local/tracker/<firm_id>/<n>
 *   - detail->>'provenance' = 'dev-seed-tracker'
 *   Purge predicate: url LIKE 'https://seed.local/tracker/%'
 *                    AND detail->>'provenance' = 'dev-seed-tracker', scoped to firm_id.
 *
 * SOURCES: regulator rows look up source_id by agency from `sources` and ERROR if a needed
 * source is missing (never invented). Parliamentary rows set source_id = null (there are
 * no parliamentary sources yet).
 *
 * IDEMPOTENT: deletes this firm's prior synthetic tracker rows (by marker) before inserting.
 *
 * CLEANUP: scripts/dev-unseed-tracker.ts <firm_id>  (also requires firm_id).
 */
import { createClient } from '@supabase/supabase-js'

const TRACKER_PROVENANCE = 'dev-seed-tracker'
const SEED_URL_PREFIX = 'https://seed.local/tracker/'
const seedUrl = (firmId: string, n: number) => `${SEED_URL_PREFIX}${firmId}/${n}`

// --- env (service-role; never printed) ---------------------------------------
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

// --- required firm_id arg (no default) ---------------------------------------
const firmId = process.argv[2]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!firmId || !UUID_RE.test(firmId)) {
  console.error('Usage: npx tsx scripts/dev-seed-tracker.ts <firm_id>')
  console.error('  <firm_id> is required and must be a UUID. No default; will not run blind.')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// --- dates, all relative to today --------------------------------------------
const MS_DAY = 86_400_000
const TODAY = new Date()
function dateInDays(n: number): string {
  return new Date(TODAY.getTime() + n * MS_DAY).toISOString().slice(0, 10) // YYYY-MM-DD
}
function daysUntil(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`).getTime()
  const t0 = new Date(`${TODAY.toISOString().slice(0, 10)}T00:00:00Z`).getTime()
  return Math.round((d - t0) / MS_DAY)
}

type Stage =
  | 'introduced'
  | 'first_reading'
  | 'second_reading'
  | 'in_committee'
  | 'third_reading'
  | 'other_chamber'
  | 'assent'
  | 'consultation_open'
  | 'submissions_open'
  | 'inquiry_active'
  | 'sunsetting'
  | 'closed'

type SeedItem = {
  item_type: 'bill' | 'inquiry' | 'consultation' | 'instrument'
  source_type: 'regulator' | 'parliamentary'
  agency?: string // regulator rows only; looked up, errors if missing
  stage: Stage
  title: string
  relevance: string
  materiality_score: number
  horizon_date: string | null // point items
  window_opens: string | null // ranged items
  window_closes: string | null
  is_closed: boolean
}

// 11 coherent items spanning all five bands. Witness register: procedural/factual titles
// and relevance: no partisan adjectives, no horse-race framing, no merits editorialising.
const ITEMS: SeedItem[] = [
  // ---- Before Parliament ----------------------------------------------------
  {
    item_type: 'bill',
    source_type: 'parliamentary',
    stage: 'introduced',
    title: 'Treasury Laws Amendment (Tranche 2 reforms) Bill 2026',
    relevance:
      'Expands AML/CTF program obligations to additional reporting entities; review program scope for affected clients.',
    materiality_score: 78,
    horizon_date: dateInDays(45),
    window_opens: null,
    window_closes: null,
    is_closed: false,
  },
  {
    item_type: 'consultation',
    source_type: 'regulator',
    agency: 'APRA',
    stage: 'consultation_open',
    title: 'APRA consultation on CPS 230 operational risk incident reporting',
    relevance:
      'Proposed reporting requirements for operational risk incidents; assess data and control readiness for ADIs and insurers.',
    materiality_score: 64,
    horizon_date: dateInDays(35),
    window_opens: null,
    window_closes: null,
    is_closed: false,
  },
  {
    item_type: 'consultation',
    source_type: 'regulator',
    agency: 'ASIC',
    stage: 'consultation_open',
    title: 'ASIC consultation on sustainability reporting assurance expectations',
    relevance:
      'Proposed phasing of reasonable assurance and assurer competency requirements; assess assurance-practice readiness.',
    materiality_score: 38,
    horizon_date: dateInDays(40),
    window_opens: null,
    window_closes: null,
    is_closed: false,
  },

  // ---- In Progress ----------------------------------------------------------
  {
    item_type: 'bill',
    source_type: 'parliamentary',
    stage: 'second_reading',
    title: 'Privacy and Other Legislation Amendment Bill 2026',
    relevance:
      'Introduces a statutory tort for serious invasions of privacy; map exposure across client advisory engagements.',
    materiality_score: 82,
    horizon_date: dateInDays(50),
    window_opens: null,
    window_closes: null,
    is_closed: false,
  },
  {
    item_type: 'bill',
    source_type: 'parliamentary',
    stage: 'in_committee',
    title: 'Corporations Amendment (Sustainability Reporting Assurance) Bill 2026',
    relevance:
      'Sets assurance requirements for sustainability reports; shapes assurance methodology and client readiness work.',
    materiality_score: 60,
    horizon_date: dateInDays(40),
    window_opens: null,
    window_closes: null,
    is_closed: false,
  },
  {
    item_type: 'inquiry',
    source_type: 'parliamentary',
    stage: 'inquiry_active',
    title: 'Senate Economics References Committee inquiry into audit quality and competition',
    relevance:
      'Examines audit market concentration and assurance standards; monitor for scope affecting the assurance practice.',
    materiality_score: 52,
    horizon_date: dateInDays(60),
    window_opens: null,
    window_closes: null,
    is_closed: false,
  },

  // ---- Closing Soon (closing date within 14 days) ---------------------------
  {
    item_type: 'inquiry',
    source_type: 'parliamentary',
    stage: 'submissions_open',
    title:
      'Parliamentary Joint Committee inquiry into the financial services regulatory framework',
    relevance:
      'Submissions sought on regulatory duplication; prepare a submission on client compliance burden before the window closes.',
    materiality_score: 72,
    horizon_date: null,
    window_opens: dateInDays(-10),
    window_closes: dateInDays(7),
    is_closed: false,
  },
  {
    item_type: 'instrument',
    source_type: 'regulator',
    agency: 'ASIC',
    stage: 'sunsetting',
    title: 'ASIC Corporations (Financial Reporting Relief) Instrument',
    relevance:
      'Instrument sunsets shortly; it is remade or lapses, affecting reporting relief relied on by clients.',
    materiality_score: 68,
    horizon_date: dateInDays(10),
    window_opens: null,
    window_closes: null,
    is_closed: false,
  },
  {
    item_type: 'consultation',
    source_type: 'regulator',
    agency: 'OAIC',
    stage: 'consultation_open',
    title: 'OAIC consultation on the Privacy Act reform exposure draft',
    relevance:
      'Submissions on automated decision-making transparency; prepare client guidance before submissions close.',
    materiality_score: 50,
    horizon_date: null,
    window_opens: dateInDays(-8),
    window_closes: dateInDays(12),
    is_closed: false,
  },

  // ---- Sunsetting (stage sunsetting, 20–40 days out) ------------------------
  {
    item_type: 'instrument',
    source_type: 'regulator',
    agency: 'AUSTRAC',
    stage: 'sunsetting',
    title:
      'Anti-Money Laundering and Counter-Terrorism Financing Rules Instrument',
    relevance:
      'Rules are scheduled to sunset; AUSTRAC is expected to remake them. Track for changes to program obligations.',
    materiality_score: 58,
    horizon_date: dateInDays(30),
    window_opens: null,
    window_closes: null,
    is_closed: false,
  },

  // ---- Closed --------------------------------------------------------------
  {
    item_type: 'bill',
    source_type: 'parliamentary',
    stage: 'assent',
    title: 'Financial Accountability Regime (Consequential Amendments) Bill 2026',
    relevance:
      'Received assent; commencement obligations apply to ADIs and insurers. Confirm client readiness.',
    materiality_score: 80,
    horizon_date: dateInDays(-5),
    window_opens: null,
    window_closes: null,
    is_closed: true,
  },
]

// Band derivation: mirrors how the Tracker view groups rows, used here only for the
// stdout summary. Closing Soon is date-driven and takes precedence over stage.
function bandOf(it: SeedItem): string {
  if (it.is_closed) return 'Closed'
  const closing = it.window_closes ?? it.horizon_date
  if (closing !== null) {
    const d = daysUntil(closing)
    if (d >= 0 && d <= 14) return 'Closing Soon'
  }
  if (it.stage === 'sunsetting') return 'Sunsetting'
  const inProgress: Stage[] = [
    'second_reading',
    'in_committee',
    'third_reading',
    'other_chamber',
    'inquiry_active',
    'submissions_open',
  ]
  if (inProgress.includes(it.stage)) return 'In Progress'
  return 'Before Parliament' // introduced, first_reading, consultation_open
}

async function sourceIdForAgency(agency: string): Promise<string> {
  const { data, error } = await supabase
    .from('sources')
    .select('id')
    .eq('agency', agency)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`source lookup for ${agency} failed: ${error.message}`)
  if (!data) {
    throw new Error(
      `No source row for agency "${agency}". Ensure the regulator sources seed migration has been applied.`
    )
  }
  return (data as { id: string }).id
}

async function deleteSeedRows(targetFirmId: string): Promise<number> {
  const del = await supabase
    .from('tracker_items')
    .delete()
    .eq('firm_id', targetFirmId)
    .like('url', `${SEED_URL_PREFIX}%`)
    .eq('detail->>provenance', TRACKER_PROVENANCE)
    .select('id')
  if (del.error) throw new Error(`prior-cleanup: tracker_items delete failed: ${del.error.message}`)
  return del.data?.length ?? 0
}

async function main(): Promise<void> {
  console.log(`Seeding synthetic tracker_items for firm ${firmId} …`)

  const removed = await deleteSeedRows(firmId)
  if (removed > 0) console.log(`  cleared ${removed} prior synthetic row(s).`)

  const rows = []
  for (const [i, it] of ITEMS.entries()) {
    const source_id = it.source_type === 'regulator' ? await sourceIdForAgency(it.agency!) : null
    rows.push({
      firm_id: firmId,
      source_id,
      source_type: it.source_type,
      item_type: it.item_type,
      stage: it.stage,
      title: it.title,
      relevance: it.relevance,
      materiality_score: it.materiality_score,
      horizon_date: it.horizon_date,
      window_opens: it.window_opens,
      window_closes: it.window_closes,
      url: seedUrl(firmId, i + 1),
      detail: { provenance: TRACKER_PROVENANCE },
      is_closed: it.is_closed,
    })
  }

  const ins = await supabase.from('tracker_items').insert(rows).select('id')
  if (ins.error) throw new Error(`tracker_items insert failed: ${ins.error.message}`)

  // Summary table: count per band + min/max materiality.
  const bands = ['Before Parliament', 'In Progress', 'Closing Soon', 'Sunsetting', 'Closed']
  const counts: Record<string, number> = Object.fromEntries(bands.map((b) => [b, 0]))
  for (const it of ITEMS) counts[bandOf(it)] += 1
  const scores = ITEMS.map((i) => i.materiality_score)

  console.log(`\nDone. Inserted ${ins.data?.length ?? rows.length} tracker_items.`)
  console.log('Band                 Count')
  console.log('-------------------- -----')
  for (const b of bands) console.log(`${b.padEnd(20)} ${String(counts[b]).padStart(5)}`)
  console.log(`\nMateriality: min ${Math.min(...scores)}, max ${Math.max(...scores)}.`)
  console.log(`Marker: url prefix "${SEED_URL_PREFIX}" + detail->>'provenance' = '${TRACKER_PROVENANCE}'.`)
  console.log(`Cleanup: npx tsx scripts/dev-unseed-tracker.ts ${firmId}`)
}

main().catch((err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
