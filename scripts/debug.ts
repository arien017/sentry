import { adminClient } from '../lib/supabase/admin'

async function main() {
  console.log('\n--- publications ---')
  const { data: pubs, error: pubErr } = await adminClient
    .from('publications')
    .select('id, title, source_type, ingested_at')
    .order('ingested_at', { ascending: false })
    .limit(5)
  if (pubErr) console.error('ERROR:', pubErr.message)
  else console.log(pubs?.length ? pubs : 'EMPTY')

  console.log('\n--- firms ---')
  const { data: firms, error: firmErr } = await adminClient
    .from('firms')
    .select('id, name')
  if (firmErr) console.error('ERROR:', firmErr.message)
  else console.log(firms?.length ? firms : 'EMPTY')

  console.log('\n--- firm_profiles ---')
  const { data: profiles, error: profErr } = await adminClient
    .from('firm_profiles')
    .select('id, firm_id, attributes')
  if (profErr) console.error('ERROR:', profErr.message)
  else console.log(profiles?.length ? profiles : 'EMPTY')

  console.log('\n--- firms with profiles join ---')
  const { data: joined, error: joinErr } = await adminClient
    .from('firms')
    .select('id, name, firm_profiles(attributes)')
  if (joinErr) console.error('ERROR:', joinErr.message)
  else console.log(JSON.stringify(joined, null, 2))

  console.log('\n--- classifications ---')
  const { data: cls, error: clsErr } = await adminClient
    .from('classifications')
    .select('id, firm_id, publication_id, materiality_score')
    .limit(5)
  if (clsErr) console.error('ERROR:', clsErr.message)
  else console.log(cls?.length ? cls : 'EMPTY')
}

main().catch(console.error)
