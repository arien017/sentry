// Throwaway inspector for the APRA listing + detail pages (Week 6, Step 0).
// Usage:
//   npx tsx scripts/inspect-apra.ts            -> parse listing, print first 3 items
//   npx tsx scripts/inspect-apra.ts <detailUrl> -> fetch one detail page, print body candidates
import * as cheerio from 'cheerio'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SentryBot/0.1 (regulatory monitoring)'

const LISTING_URL = 'https://www.apra.gov.au/news-and-publications'

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  return res.text()
}

async function inspectListing() {
  const html = await fetchHtml(LISTING_URL)
  const $ = cheerio.load(html)

  const rows = $('div.views-row')
  console.log(`views-row count: ${rows.length}\n`)

  rows.slice(0, 3).each((idx, el) => {
    const row = $(el)
    const timeEl = row.find('time').first()
    const dateText = timeEl.text().trim()
    const dateAttr = timeEl.attr('datetime') ?? null
    const title = row.find('h4').first().text().trim()
    const href = row.find('a.tile__link-cover').first().attr('href') ?? null
    const category = row.find('.tile__subject .field-field-category').first().text().trim()

    console.log(`--- item ${idx + 1} ---`)
    console.log(`date text:     ${dateText}`)
    console.log(`datetime attr: ${dateAttr}`)
    console.log(`title:         ${title}`)
    console.log(`detail href:   ${href}`)
    console.log(`category:      ${category}\n`)
  })
}

async function inspectDetail(url: string) {
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)

  // Print candidate body containers with text length so we can pick the right one
  const candidates = [
    'article .field--name-body',
    'article .field--type-text-with-summary',
    '.node__content',
    'main article',
    '.region-content article',
  ]
  for (const sel of candidates) {
    const el = $(sel).first()
    const text = el.text().replace(/\s+/g, ' ').trim()
    console.log(`--- selector: ${sel} -> ${el.length ? `${text.length} chars` : 'NO MATCH'}`)
    if (el.length && text.length > 0) {
      console.log(text.slice(0, 600) + (text.length > 600 ? ' …' : '') + '\n')
    }
  }
}

const arg = process.argv[2]
if (arg) {
  inspectDetail(arg).catch(console.error)
} else {
  inspectListing().catch(console.error)
}
