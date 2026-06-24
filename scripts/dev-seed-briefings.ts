/**
 * DEV SEED — synthetic Level 1 briefings for local Chat / read-view testing.
 *
 * RUN BY HAND with the service-role key (read from env; never printed):
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/dev-seed-briefings.ts <firm_id>
 *
 *   <firm_id> is REQUIRED (a UUID). There is no default — the script will not run blind.
 *   DELOITTE is fe739d35-7c79-47a9-9c5a-2f8ba43702b8.
 *
 * WHAT IT DOES: writes a firm-correct profile + 8 hand-authored (publication →
 * classification → briefing) triples, all consistently scoped to <firm_id> so the
 * read views' four-table !inner join returns every seeded briefing. These are
 * HAND-AUTHORED fixtures — they validate rendering/composition plumbing ONLY and prove
 * nothing about classifier/summariser behaviour.
 *
 * SYNTHETIC MARKERS (so the set is identifiable and cleanly deletable):
 *   - publications.url        = `https://seed.local/<firm_id>/<slug>`   (primary, firm-scoped)
 *   - publications.external_id= `dev-seed:<firm_id>:<slug>`
 *   - publications.detail     = { seed: true, marker: 'dev-seed' }
 *   - classifications.model_version = 'dev-seed'   (real ones use the Haiku model string)
 *   - briefings               : no own marker column; identified via their firm-scoped
 *                               'dev-seed' classification.
 *   Sources are REUSED by agency (never synthetic), so nothing to clean there.
 *
 * IDEMPOTENT: deletes its own prior synthetic rows (by marker, for this firm) before
 * inserting, so re-running does not duplicate. The firm profile is upserted.
 *
 * CLEANUP: scripts/dev-unseed-briefings.ts <firm_id>  (also requires firm_id).
 */
import { createClient } from '@supabase/supabase-js'

const SEED_MODEL_VERSION = 'dev-seed'
const seedUrlPrefix = (firmId: string) => `https://seed.local/${firmId}/`

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
  console.error('Usage: npx tsx scripts/dev-seed-briefings.ts <firm_id>')
  console.error('  <firm_id> is required and must be a UUID. No default; will not run blind.')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// --- firm-correct profile for DELOITTE (conforms to the observed base keys
// name/size/type/sectors, extended with descriptive keys; attributes is freeform jsonb) -
const DELOITTE_PROFILE = {
  name: 'Deloitte Australia',
  size: 'large',
  type: 'professional services (audit and advisory)',
  tier: 'Big Four',
  sectors: ['audit', 'assurance', 'advisory'],
  clients: [
    'ASX-listed entities',
    'ADIs',
    'insurers',
    'superannuation funds',
    'large private groups',
  ],
  jurisdiction: 'Australia — federal and all states',
  regulators_of_interest: [
    'APRA',
    'ASIC',
    'AUSTRAC',
    'AER',
    'ACCC',
    'OAIC',
    'TGA',
    'Federal Register of Legislation',
  ],
  materiality_drivers: [
    'audit, assurance and financial-reporting standard changes',
    'prudential standards affecting ADIs and insurers (advisory exposure)',
    'AML/CTF (AUSTRAC) for client compliance work',
    'governance, director duties and continuous disclosure (ASIC)',
    'privacy and data (OAIC) for advisory and own obligations',
    'consumer and competition (ACCC) for client advisory',
  ],
  low_relevance: [
    'retail-specific consumer alerts with no advisory or audit angle',
    'notices outside financial-services / regulated-entity advisory',
  ],
  posture:
    'Monitors for client-advisory relevance and own-firm obligation, not as a single-sector regulated entity.',
}

// --- the 8 hand-authored items (band spread: 3 high, 3 elevated, 2 routine) ---
interface SeedItem {
  agency: string
  score: number
  publishedAt: string
  title: string
  summary: string
  rationale: string
}

const ITEMS: SeedItem[] = [
  {
    agency: 'APRA',
    score: 88,
    publishedAt: '2026-06-16',
    title: 'APRA finalises transition expectations for CPS 230 Operational Risk Management',
    summary:
      'APRA has finalised its transition expectations for Prudential Standard CPS 230 Operational Risk Management, confirming the timetable by which regulated entities must map material business services, set tolerance levels, and test service-provider arrangements. The standard applies to ADIs, insurers, and superannuation trustees.',
    rationale:
      'Deloitte advises a large portfolio of APRA-regulated ADIs and insurers on operational resilience; finalised CPS 230 transition expectations drive material assurance, control-mapping, and third-party-risk engagements across that client base.',
  },
  {
    agency: 'ASIC',
    score: 76,
    publishedAt: '2026-06-15',
    title: 'ASIC updates regulatory guidance on continuous disclosure obligations for listed entities',
    summary:
      'ASIC has updated its regulatory guidance on continuous disclosure, clarifying expectations for listed entities on the timing of market-sensitive announcements and the evidence boards should retain to support disclosure judgements.',
    rationale:
      'Continuous disclosure sits at the centre of Deloitte audit and governance advisory for ASX-listed clients; revised guidance changes audit evidence expectations and board advisory across the listed-client portfolio.',
  },
  {
    agency: 'AUSTRAC',
    score: 71,
    publishedAt: '2026-06-13',
    title: 'AUSTRAC issues updated guidance on customer due diligence for reporting entities',
    summary:
      'AUSTRAC has issued updated guidance on customer due diligence, setting out strengthened expectations for identifying beneficial ownership and for ongoing monitoring by reporting entities under the AML/CTF regime.',
    rationale:
      'Deloitte financial-crime advisory supports reporting entities across banking and gaming on AML/CTF programs; strengthened customer due diligence expectations generate program-uplift, remediation, and independent-review engagements.',
  },
  {
    agency: 'OAIC',
    score: 64,
    publishedAt: '2026-06-11',
    title: 'OAIC publishes guidance on organisational readiness for Privacy Act reforms',
    summary:
      'The OAIC has published guidance to help organisations prepare for the Privacy Act reforms, addressing governance, data-handling transparency, and the handling of automated decision-making.',
    rationale:
      'Privacy reform bears on both Deloitte own-firm data obligations and its privacy advisory engagements; the readiness guidance shapes client uplift work across multiple sectors, though obligations are still being phased in.',
  },
  {
    agency: 'ASIC',
    score: 52,
    publishedAt: '2026-06-09',
    title: 'ASIC consults on assurance expectations for sustainability reporting',
    summary:
      'ASIC has opened consultation on assurance expectations for mandatory sustainability reporting, seeking views on the phasing of reasonable assurance and on the competencies expected of assurance providers.',
    rationale:
      'Sustainability-reporting assurance is an emerging Deloitte service line; the consultation shapes assurance methodology and client-readiness work, but materiality is moderated because the requirements are not yet final.',
  },
  {
    agency: 'ACCC',
    score: 45,
    publishedAt: '2026-06-06',
    title: 'ACCC issues guidance on changes to the merger authorisation process',
    summary:
      'The ACCC has issued guidance on changes to the merger authorisation process, describing revised notification thresholds and the information the regulator expects parties to provide.',
    rationale:
      'Relevant to Deloitte transaction advisory for large private and listed clients; impact is moderate and depends on whether specific client deals fall within the revised thresholds.',
  },
  {
    agency: 'AER',
    score: 33,
    publishedAt: '2026-06-03',
    title: 'AER publishes annual retail energy market performance report',
    summary:
      'The AER has published its annual report on retail energy market performance, covering competition, customer hardship, and compliance with the retail energy rules.',
    rationale:
      'Limited direct exposure for Deloitte; relevant only to a small subset of energy-sector clients and carries no audit or assurance standard change.',
  },
  {
    agency: 'TGA',
    score: 18,
    publishedAt: '2026-05-30',
    title: 'TGA issues consumer safety alert on an imported therapeutic good',
    summary:
      'The TGA has issued a consumer safety alert advising the public not to use a specified imported therapeutic good found to contain an undisclosed substance.',
    rationale:
      'Retail consumer-safety notice with no audit, assurance, or regulated-entity advisory angle for the Deloitte client base; included only to populate the routine band.',
  },
]

// --- delete this firm's prior synthetic rows (marker-based, FK-safe order) ----
async function deleteSeedRows(targetFirmId: string): Promise<void> {
  const { data: cls, error: clsErr } = await supabase
    .from('classifications')
    .select('id')
    .eq('firm_id', targetFirmId)
    .eq('model_version', SEED_MODEL_VERSION)
  if (clsErr) throw new Error(`prior-cleanup: classifications lookup failed: ${clsErr.message}`)
  const clsIds = (cls ?? []).map((c) => (c as { id: string }).id)

  if (clsIds.length > 0) {
    const { error: bErr } = await supabase
      .from('briefings')
      .delete()
      .eq('firm_id', targetFirmId)
      .in('classification_id', clsIds)
    if (bErr) throw new Error(`prior-cleanup: briefings delete failed: ${bErr.message}`)

    const { error: cErr } = await supabase
      .from('classifications')
      .delete()
      .eq('firm_id', targetFirmId)
      .in('id', clsIds)
    if (cErr) throw new Error(`prior-cleanup: classifications delete failed: ${cErr.message}`)
  }

  const { error: pErr } = await supabase
    .from('publications')
    .delete()
    .like('url', `${seedUrlPrefix(targetFirmId)}%`)
  if (pErr) throw new Error(`prior-cleanup: publications delete failed: ${pErr.message}`)
}

// --- reuse an existing source by agency (never create synthetic sources) ------
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

async function main(): Promise<void> {
  console.log(`Seeding synthetic briefings for firm ${firmId} …`)

  // Idempotency: clear this firm's prior synthetic set first.
  await deleteSeedRows(firmId)

  // Firm-correct profile (upsert on the unique firm_id).
  const { error: profErr } = await supabase
    .from('firm_profiles')
    .upsert(
      { firm_id: firmId, attributes: DELOITTE_PROFILE, updated_at: new Date().toISOString() },
      { onConflict: 'firm_id' }
    )
  if (profErr) throw new Error(`firm_profiles upsert failed: ${profErr.message}`)
  console.log('  profile upserted.')

  let inserted = 0
  for (const [i, item] of ITEMS.entries()) {
    const slug = `${String(i + 1).padStart(2, '0')}-${item.agency.toLowerCase()}`
    const sourceId = await sourceIdForAgency(item.agency)

    const { data: pub, error: pubErr } = await supabase
      .from('publications')
      .insert({
        source_id: sourceId,
        source_type: 'regulator',
        external_id: `dev-seed:${firmId}:${slug}`,
        title: item.title,
        url: `${seedUrlPrefix(firmId)}${slug}`,
        published_at: item.publishedAt,
        detail: { seed: true, marker: SEED_MODEL_VERSION },
      })
      .select('id')
      .single()
    if (pubErr) throw new Error(`publications insert (${slug}) failed: ${pubErr.message}`)
    const publicationId = (pub as { id: string }).id

    const { data: cls, error: clsErr } = await supabase
      .from('classifications')
      .insert({
        firm_id: firmId,
        publication_id: publicationId,
        materiality_score: item.score,
        rationale: item.rationale,
        model_version: SEED_MODEL_VERSION,
      })
      .select('id')
      .single()
    if (clsErr) throw new Error(`classifications insert (${slug}) failed: ${clsErr.message}`)
    const classificationId = (cls as { id: string }).id

    const { error: brErr } = await supabase.from('briefings').insert({
      firm_id: firmId,
      classification_id: classificationId,
      channel: item.score >= 70 ? 'alert' : 'digest',
      summary: item.summary,
      delivered_at: new Date().toISOString(),
    })
    if (brErr) throw new Error(`briefings insert (${slug}) failed: ${brErr.message}`)

    inserted += 1
    console.log(`  [${item.score.toString().padStart(2, ' ')}] ${item.agency} — ${item.title}`)
  }

  const high = ITEMS.filter((i) => i.score >= 70).length
  const elevated = ITEMS.filter((i) => i.score >= 40 && i.score < 70).length
  const routine = ITEMS.filter((i) => i.score < 40).length
  console.log(
    `\nDone. ${inserted} briefings seeded — high(>=70): ${high}, elevated(40-69): ${elevated}, routine(<40): ${routine}.`
  )
  console.log(`Marker: publications.url prefix "${seedUrlPrefix(firmId)}" + classifications.model_version "${SEED_MODEL_VERSION}".`)
  console.log(`Cleanup: npx tsx scripts/dev-unseed-briefings.ts ${firmId}`)
}

main().catch((err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
