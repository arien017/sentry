import { XMLParser } from 'fast-xml-parser'
import * as cheerio from 'cheerio'
import { inngest } from './client'
import { adminClient } from '@/lib/supabase/admin'
import { classifyPublication } from '@/lib/llm/classify'
import { summarisePublication } from '@/lib/llm/summarise'

const MATERIALITY_THRESHOLD = 60

const TGA_FEED_URL = 'https://tga.gov.au/feeds/alert.xml'
// TGA blocks bot UAs; a browser UA is required for the feed to respond.
const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
}

// ---------------------------------------------------------------------------
// Function 1: Poll TGA feed and insert new publications
// Triggers: hourly cron + manual event so it can be invoked from dev UI
// ---------------------------------------------------------------------------
export const pollTgaFeed = inngest.createFunction(
  {
    id: 'poll-tga-feed',
    name: 'Poll TGA Alert Feed',
    triggers: [{ event: 'poll/tga.manual' }, { cron: '0 * * * *' }],
  },
  async ({ step }) => {
    const xml = await step.run('fetch-feed', async () => {
      const res = await fetch(TGA_FEED_URL, { headers: FETCH_HEADERS })
      if (!res.ok) throw new Error(`TGA feed returned ${res.status}`)
      return res.text()
    })

    const items = await step.run('parse-feed', async () => {
      const parser = new XMLParser({ ignoreAttributes: false })
      const parsed = parser.parse(xml) as { rss?: { channel?: { item?: unknown } } }
      const raw = parsed?.rss?.channel?.item ?? []
      const arr = Array.isArray(raw) ? raw : [raw]
      return arr.map((item) => {
        const i = item as Record<string, unknown>
        const guidVal = i.guid
        const guid =
          typeof guidVal === 'object' && guidVal !== null
            ? String((guidVal as Record<string, unknown>)['#text'] ?? '')
            : String(guidVal ?? i.link ?? '')
        return {
          title: String(i.title ?? ''),
          link: String(i.link ?? ''),
          guid,
          pubDate: String(i.pubDate ?? ''),
          description: String(i.description ?? ''),
        }
      })
    })

    const source = await step.run('lookup-source', async () => {
      const { data, error } = await adminClient
        .from('sources')
        .select('id')
        .eq('agency', 'TGA')
        .single()
      if (error || !data) throw new Error(`TGA source row not found: ${error?.message}`)
      return data
    })

    let newCount = 0

    for (const item of items) {
      const slugId = item.guid.replace(/[^a-zA-Z0-9]/g, '-').slice(-40)

      const result = await step.run(`upsert-${slugId}`, async () => {
        const published_at = item.pubDate ? new Date(item.pubDate).toISOString() : null

        const { data, error } = await adminClient
          .from('publications')
          .upsert(
            {
              source_id: source.id,
              source_type: 'regulator',
              external_id: item.guid,
              title: item.title,
              url: item.link || null,
              published_at,
              detail: { description: item.description },
            },
            { onConflict: 'source_id,external_id', ignoreDuplicates: true }
          )
          .select('id')
          .maybeSingle()

        if (error) throw new Error(`Upsert failed for ${item.guid}: ${error.message}`)
        return data
      })

      if (result) {
        newCount++
        await step.sendEvent(`pub-created-${result.id}`, {
          name: 'publication/created',
          data: { publication_id: result.id },
        })
      }
    }

    return { parsed: items.length, new: newCount }
  }
)

// ---------------------------------------------------------------------------
// Function 1b: Poll APRA news listing (HTML scrape)
// Triggers: hourly cron at :30 (staggered from TGA) + manual event for dev UI
// ---------------------------------------------------------------------------
const APRA_BASE = 'https://www.apra.gov.au'
const APRA_LISTING_URL = `${APRA_BASE}/news-and-publications`
// Descriptive but browser-like UA; APRA serves full HTML to this.
const APRA_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SentryBot/0.1 (regulatory monitoring)',
}

// "4 June 2026" -> ISO. Fallback only; the listing's <time datetime> attr is preferred.
function parseApraDateText(dateText: string): string | null {
  const m = dateText.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (!m) return null
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
  }
  const mm = months[m[2].toLowerCase()]
  if (!mm) return null
  const d = new Date(`${m[3]}-${mm}-${m[1].padStart(2, '0')}T00:00:00+10:00`)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export const pollApraListing = inngest.createFunction(
  {
    id: 'poll-apra-listing',
    name: 'Poll APRA News & Publications',
    triggers: [{ event: 'poll/apra.manual' }, { cron: '30 * * * *' }],
  },
  async ({ step }) => {
    const items = await step.run('fetch-and-parse-listing', async () => {
      const res = await fetch(APRA_LISTING_URL, { headers: APRA_FETCH_HEADERS })
      if (!res.ok) throw new Error(`APRA listing returned ${res.status}`)
      const $ = cheerio.load(await res.text())
      const out: Array<{
        title: string
        url: string
        published_at: string | null
        category: string
      }> = []
      $('div.views-row').each((_, el) => {
        const row = $(el)
        const title = row.find('h4').first().text().trim()
        const href = row.find('a.tile__link-cover').first().attr('href')
        if (!title || !href) return // not a news tile
        const timeEl = row.find('time').first()
        const datetimeAttr = timeEl.attr('datetime')
        const published_at =
          datetimeAttr && !isNaN(new Date(datetimeAttr).getTime())
            ? new Date(datetimeAttr).toISOString()
            : parseApraDateText(timeEl.text())
        out.push({
          title,
          url: new URL(href, APRA_BASE).toString(),
          published_at,
          category: row.find('.tile__subject .field-field-category').first().text().trim(),
        })
      })
      return out
    })

    const source = await step.run('lookup-source', async () => {
      const { data, error } = await adminClient
        .from('sources')
        .select('id')
        .eq('agency', 'APRA')
        .single()
      if (error || !data) throw new Error(`APRA source row not found: ${error?.message}`)
      return data
    })

    let newCount = 0

    for (const item of items) {
      const slugId = item.url.replace(/[^a-zA-Z0-9]/g, '-').slice(-40)

      // Skip the detail fetch for items we already hold — keeps the poll polite.
      const existing = await step.run(`check-${slugId}`, async () => {
        const { data, error } = await adminClient
          .from('publications')
          .select('id')
          .eq('source_id', source.id)
          .eq('external_id', item.url)
          .maybeSingle()
        if (error) throw new Error(`Existence check failed for ${item.url}: ${error.message}`)
        return data
      })
      if (existing) continue

      const body = await step.run(`fetch-detail-${slugId}`, async () => {
        try {
          const res = await fetch(item.url, { headers: APRA_FETCH_HEADERS })
          if (!res.ok) throw new Error(`status ${res.status}`)
          const $ = cheerio.load(await res.text())
          const block = $('.block-field-blocknodenews-itembody').first()
          // Join <p> elements with blank lines so paragraphs stay readable;
          // fall back to raw block text if the body holds no <p> tags.
          const paras = block
            .find('p')
            .map((_, p) => $(p).text().replace(/\s+/g, ' ').trim())
            .get()
            .filter(Boolean)
          return paras.length ? paras.join('\n\n') : block.text().replace(/[ \t]+/g, ' ').trim()
        } catch (err) {
          // Ingest with an empty body rather than wedging the poll on one bad
          // page; the classifier scores low on insufficient info by design.
          console.error(`APRA detail fetch failed for ${item.url}:`, err)
          return ''
        }
      })

      const row = await step.run(`upsert-${slugId}`, async () => {
        const { data, error } = await adminClient
          .from('publications')
          .upsert(
            {
              source_id: source.id,
              source_type: 'regulator',
              external_id: item.url,
              title: item.title,
              url: item.url,
              published_at: item.published_at,
              detail: { category: item.category, body },
            },
            { onConflict: 'source_id,external_id', ignoreDuplicates: true }
          )
          .select('id')
          .maybeSingle()
        if (error) throw new Error(`Upsert failed for ${item.url}: ${error.message}`)
        return data
      })

      if (row) {
        newCount++
        await step.sendEvent(`pub-created-${row.id}`, {
          name: 'publication/created',
          data: { publication_id: row.id },
        })
      }

      // Politeness: pause between detail-page fetches.
      await step.sleep(`pause-${slugId}`, '1s')
    }

    return { listed: items.length, new: newCount }
  }
)

// ---------------------------------------------------------------------------
// Function 2: Classify a new publication against every firm
// ---------------------------------------------------------------------------
export const classifyNewPublication = inngest.createFunction(
  {
    id: 'classify-publication',
    name: 'Classify Publication Against All Firms',
    triggers: [{ event: 'publication/created' }],
  },
  async ({ event, step }) => {
    const { publication_id } = (event as unknown as { data: { publication_id: string } }).data

    const publication = await step.run('fetch-publication', async () => {
      const { data, error } = await adminClient
        .from('publications')
        .select('id, title, url, detail, published_at')
        .eq('id', publication_id)
        .single()
      if (error || !data) throw new Error(`Publication not found: ${error?.message}`)
      return data
    })

    const firms = await step.run('fetch-firms', async () => {
      const { data, error } = await adminClient
        .from('firms')
        .select('id, name, firm_profiles(attributes)')
      if (error) throw new Error(`Failed to fetch firms: ${error.message}`)
      // Runtime shape: firm_profiles is a single object (firm_id is unique),
      // but supabase-js infers an array — hence the cast through unknown.
      return (data ?? []) as unknown as Array<{
        id: string
        name: string
        firm_profiles: { attributes: Record<string, unknown> } | null
      }>
    })

    for (const firm of firms) {
      const slugId = firm.id.slice(-8)

      const classResult = await step.run(`classify-firm-${slugId}`, async () => {
        const profile = {
          name: firm.name,
          ...(firm.firm_profiles?.attributes ?? {}),
        }
        // APRA items carry full body text in detail.body; TGA items only have
        // detail.description. Prefer body, fall back to description.
        const detail = publication.detail as Record<string, unknown> | null
        const pubText = String(detail?.body ?? detail?.description ?? '')

        const result = await classifyPublication(
          { title: publication.title, text: pubText },
          profile
        )

        const { error } = await adminClient.from('classifications').upsert(
          {
            firm_id: firm.id,
            publication_id: publication.id,
            materiality_score: result.materiality_score,
            rationale: result.rationale,
            model_version: 'claude-haiku-4-5-20251001',
          },
          { onConflict: 'firm_id,publication_id' }
        )
        if (error) throw new Error(`Classification upsert failed: ${error.message}`)

        if (result.materiality_score >= MATERIALITY_THRESHOLD) {
          const { data: classRow } = await adminClient
            .from('classifications')
            .select('id')
            .eq('firm_id', firm.id)
            .eq('publication_id', publication.id)
            .single()
          return {
            threshold_crossed: true as const,
            classification_id: classRow?.id ?? null,
            score: result.materiality_score,
          }
        }

        return { threshold_crossed: false as const, score: result.materiality_score }
      })

      if (classResult.threshold_crossed && classResult.classification_id) {
        await step.sendEvent(`threshold-${classResult.classification_id}`, {
          name: 'classification/threshold-crossed',
          data: { classification_id: classResult.classification_id },
        })
      }
    }

    return { publication_id, firms_classified: firms.length }
  }
)

// ---------------------------------------------------------------------------
// Function 3: Summarise and write a briefing when threshold is crossed
// ---------------------------------------------------------------------------
export const createBriefing = inngest.createFunction(
  {
    id: 'create-briefing',
    name: 'Create Briefing on Threshold Crossed',
    triggers: [{ event: 'classification/threshold-crossed' }],
  },
  async ({ event, step }) => {
    const { classification_id } = (event as unknown as { data: { classification_id: string } }).data

    const { classification, publication } = await step.run('fetch-context', async () => {
      const { data: cls, error: clsErr } = await adminClient
        .from('classifications')
        .select('id, firm_id, publication_id, materiality_score, rationale')
        .eq('id', classification_id)
        .single()
      if (clsErr || !cls) throw new Error(`Classification not found: ${clsErr?.message}`)

      const { data: pub, error: pubErr } = await adminClient
        .from('publications')
        .select('id, title, url, published_at, detail')
        .eq('id', cls.publication_id)
        .single()
      if (pubErr || !pub) throw new Error(`Publication not found: ${pubErr?.message}`)

      return { classification: cls, publication: pub }
    })

    const summary = await step.run('summarise', async () => {
      const detail = publication.detail as Record<string, unknown> | null
      const pubText = String(detail?.body ?? detail?.description ?? '')
      return summarisePublication({
        title: publication.title,
        text: pubText,
        url: publication.url ?? undefined,
        published_at: publication.published_at ?? undefined,
      })
    })

    await step.run('insert-briefing', async () => {
      const { error } = await adminClient.from('briefings').insert({
        firm_id: classification.firm_id,
        classification_id: classification.id,
        channel: 'digest',
        summary,
        delivered_at: new Date().toISOString(),
      })
      if (error) throw new Error(`Briefing insert failed: ${error.message}`)
    })

    return { classification_id, publication_id: publication.id }
  }
)
