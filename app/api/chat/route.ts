/**
 * Chat streaming endpoint — the foundation of the Chat view (Surface one, view five).
 *
 * CONTRACT: messages-in, token-stream-out. Stateless and persistence-ready — it receives
 * a clean multi-turn message array and returns a streamed completion, assuming nothing
 * about where history is stored. (DB-backed conversation persistence is a deferred
 * follow-up; nothing here precludes it.)
 *
 * SUBSTRATE (Option A, settled): Chat composes ONLY over the logged-in firm's OWN
 * briefings — the same firm-scoped set the read views render — and cites only those.
 * No vector store, no retrieval: the firm's entire (small) briefing set is stuffed into
 * the system prompt.
 *
 * SECURITY BOUNDARY: the firm is derived from the SSR session (RLS via auth_firm_id()).
 * The route reads ONLY `messages` from the request body — it NEVER accepts a firm_id from
 * the client, so a user can only ever chat over their own firm's briefings.
 *
 * CITATION CONTRACT (depended on by later Chat work — keep stable):
 *   The model cites a briefing by its briefings.id using the exact token:
 *       [[cite:BRIEFING_ID]]
 *   where BRIEFING_ID is the id of a briefing supplied in the system prompt. The token is
 *   delimiter-based ("[[cite:" … "]]") so it is trivial to regex and will not collide with
 *   normal prose. The model may ONLY emit this token for supplied ids; it must never invent
 *   one.
 *
 * Model: claude-opus-4-8 (customer-facing Opus), via the same `new Anthropic()` setup the
 * summariser uses (reads ANTHROPIC_API_KEY from env; no second/parallel client).
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { fetchBriefings } from '@/lib/home/briefings'
import type { BriefingRow } from '@/components/home/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODEL = 'claude-opus-4-8'
const MAX_TOKENS = 1024

type ChatMessage = { role: 'user' | 'assistant'; content: string }

function isChatMessage(m: unknown): m is ChatMessage {
  if (typeof m !== 'object' || m === null) return false
  const role = (m as { role?: unknown }).role
  const content = (m as { content?: unknown }).content
  return (role === 'user' || role === 'assistant') && typeof content === 'string'
}

function buildSystemPrompt(briefings: BriefingRow[]): string {
  const rules = `You are Sentry, the witness for a regulated firm. You report what regulators have done, in the firm's working language, and you cite your sources. You do not interpret beyond what your sources support, and you never promote yourself.

You answer ONLY from the briefings provided below. These briefings are this firm's own monitored regulatory items — they are your entire substrate.

HARD RULES (absolute):
1. SUBSTRATE BOUND. Use ONLY the briefings provided below to answer. Do not introduce any regulatory fact, date, figure, agency action, or claim that is not present in a supplied briefing. Do not use outside or prior knowledge about regulators, law, or current events.
2. NO INVENTED CITATIONS. Cite only briefings that appear in the set below, by their exact id. Never cite an id that is not in the set, and never invent a briefing.
3. SAY WHEN YOU DO NOT HAVE IT. If the supplied briefings do not contain what is needed to answer, say so plainly — for example, "I don't have a briefing on that." Do not guess, extrapolate, or reach beyond the briefings.
4. CITE EVERY CLAIM. Every factual statement you draw from a briefing must carry a citation token naming the specific briefing(s) that support it. The token syntax is exactly:
   [[cite:BRIEFING_ID]]
   where BRIEFING_ID is the id of a briefing from the set below. Place the token immediately after the claim it supports; if a sentence draws on more than one briefing, cite each.
5. VOICE. Factual, procedural, and firm-relevant. Match the register of the briefing summaries: no filler, no hype, no marketing, no partisan or political framing, no exclamation. Every sentence carries information.

You may summarise, compare, group, and prioritise the briefings, and explain what they say about the firm's obligations or exposure — but only as far as the briefings themselves support.`

  if (briefings.length === 0) {
    return `${rules}

There are currently NO briefings on file for this firm. Your substrate is empty. If the user asks anything that would require a briefing to answer, say plainly that you have nothing on file. Do not invent regulatory facts, dates, or citations.`
  }

  const blocks = briefings
    .map(
      (b) => `[BRIEFING ${b.id}]
Agency: ${b.agency}
Title: ${b.title}
Published: ${b.publishedAt ?? 'not stated'}
Materiality: ${b.materialityScore}
Summary: ${b.summary}
Rationale: ${b.rationale ?? 'not stated'}
Source URL: ${b.url ?? 'not stated'}`
    )
    .join('\n\n')

  return `${rules}

The following are the only briefings on file for this firm. They are your entire substrate. Cite them by id using [[cite:ID]].

<briefings>
${blocks}
</briefings>`
}

export async function POST(req: Request) {
  // Read ONLY `messages` from the body. firm_id is NEVER read from the request — the firm
  // is derived from the session below, so firm scoping cannot be client-controlled.
  const body = (await req.json().catch(() => null)) as { messages?: unknown } | null
  if (
    !body ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    !body.messages.every(isChatMessage)
  ) {
    return Response.json(
      {
        error:
          'Body must be { messages: { role: "user" | "assistant", content: string }[] } with at least one message.',
      },
      { status: 400 }
    )
  }
  const messages: ChatMessage[] = body.messages

  // Auth gate + firm derivation. RLS (auth_firm_id()) scopes the briefings to this user's
  // firm; there is no manual firm_id filter and none is accepted from the client.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let briefings: BriefingRow[]
  try {
    briefings = await fetchBriefings(supabase)
  } catch (err) {
    console.error('chat: fetchBriefings failed:', err)
    return Response.json({ error: 'Failed to load firm briefings.' }, { status: 500 })
  }

  const client = new Anthropic()

  let anthropicStream: Awaited<ReturnType<typeof client.messages.create>>
  try {
    anthropicStream = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(briefings),
      messages,
      stream: true,
    })
  } catch (err) {
    console.error('chat: anthropic stream init failed:', err)
    return Response.json({ error: 'Upstream model error.' }, { status: 502 })
  }

  // True token stream — text deltas are enqueued as they arrive; the full completion is
  // never buffered and returned whole.
  const encoder = new TextEncoder()
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        controller.close()
      } catch (err) {
        console.error('chat: stream error:', err)
        controller.error(err)
      }
    },
  })

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  })
}
