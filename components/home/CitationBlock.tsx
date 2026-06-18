// Provenance footer — ported from CitationBlock in MarketingSite.tsx, parameterised
// for live data. Uses the existing .citation / .citation a structure. When there is
// no url, the title renders as plain text (no anchor).
export function CitationBlock({
  title,
  url,
  publishedAt,
}: {
  title: string
  url: string | null
  publishedAt: string | null
}) {
  return (
    <div className="citation">
      <div style={{ marginBottom: 4 }}>{title}</div>
      {url ? (
        <div>
          <a href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        </div>
      ) : null}
      {publishedAt ? (
        <div style={{ marginTop: 4 }}>{new Date(publishedAt).toISOString().slice(0, 10)}</div>
      ) : null}
    </div>
  )
}
