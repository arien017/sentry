export const dynamic = 'force-dynamic'

import { adminClient } from '@/lib/supabase/admin'

export default async function RecentPublicationsPage() {
  const { data, error } = await adminClient
    .from('publications')
    .select('id, title, source_type, published_at, ingested_at, url')
    .order('ingested_at', { ascending: false })
    .limit(10)

  if (error) {
    return (
      <main style={{ fontFamily: 'monospace', padding: '2rem' }}>
        <h1>Admin — Recent Publications</h1>
        <p style={{ color: 'red' }}>Error: {error.message}</p>
      </main>
    )
  }

  if (!data || data.length === 0) {
    return (
      <main style={{ fontFamily: 'monospace', padding: '2rem' }}>
        <h1>Admin — Recent Publications</h1>
        <p>No publications ingested yet.</p>
      </main>
    )
  }

  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <h1>Admin — Recent Publications</h1>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
            <th style={{ padding: '0.4rem 0.8rem' }}>Title</th>
            <th style={{ padding: '0.4rem 0.8rem' }}>Type</th>
            <th style={{ padding: '0.4rem 0.8rem' }}>Published</th>
            <th style={{ padding: '0.4rem 0.8rem' }}>Ingested</th>
            <th style={{ padding: '0.4rem 0.8rem' }}>URL</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.4rem 0.8rem' }}>{row.title}</td>
              <td style={{ padding: '0.4rem 0.8rem' }}>{row.source_type}</td>
              <td style={{ padding: '0.4rem 0.8rem' }}>
                {row.published_at ? new Date(row.published_at).toISOString().slice(0, 10) : '—'}
              </td>
              <td style={{ padding: '0.4rem 0.8rem' }}>
                {new Date(row.ingested_at).toISOString().slice(0, 10)}
              </td>
              <td style={{ padding: '0.4rem 0.8rem' }}>
                {row.url ? (
                  <a href={row.url} target="_blank" rel="noreferrer">
                    link
                  </a>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
