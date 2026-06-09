import { XMLParser } from 'fast-xml-parser'
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
      return (data ?? []) as Array<{
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
        const pubText = String(
          (publication.detail as Record<string, unknown>)?.description ?? ''
        )

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
      const pubText = String(
        (publication.detail as Record<string, unknown>)?.description ?? ''
      )
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
