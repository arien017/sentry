'use client'

import { useEffect, useRef, useState } from 'react'
import { parseStreaming, parseFinal, citedIds, type CiteSegment } from './citations'
import { SourceTag } from './SourceTag'

// Chat island: in-memory multi-turn history (Decision 4a — lost on refresh; DB
// persistence is a later drop-in), streamed against POST /api/chat. The client sends
// ONLY { messages }; the firm is derived server-side, and the endpoint supplies cited-
// briefing detail (Option 1) — the client fetches no briefings and sends no firm_id.
//
// Citations: assistant text carries [[cite:BRIEFING_ID]] tokens rendered as superscript
// markers numbered PER-CONVERSATION and STABLY (citeNumbers, conversation-scoped). After
// the text stream completes, the endpoint appends a sentinel-delimited JSON trailer of the
// cited sources; the client demuxes on the sentinel, stores the sources on the finalised
// assistant message, and renders them in the provenance pane with the SAME numbers the
// markers use. Clicking marker N focuses source N in the pane.

// U+001E RECORD SEPARATOR — matches the endpoint's SOURCE_TRAILER_SENTINEL.
const SENTINEL = '\u001e'

type CitedSource = {
  id: string
  agency: string
  sourceType: 'regulator' | 'parliamentary'
  title: string
  publishedAt: string | null
  url: string | null
  materialityScore: number
}

// sources is undefined for non-answers (errors); [] means "answered, nothing cited".
type ChatMessage = { role: 'user' | 'assistant'; content: string; sources?: CitedSource[] }

const EMPTY_PROMPT =
  "Ask about your firm's briefings. Sentry answers only from what has been filed, and cites each briefing it draws on."
const ERROR_TEXT = 'Something went wrong answering that.'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function lastAssistantIndex(msgs: ChatMessage[]): number {
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'assistant') return i
  return -1
}

// Restrained scholarly footnote marker. Carries id + number as data; interactive only
// when an onSelect handler is supplied (finalised messages), so it never appears clickable
// before its source detail exists.
function CiteMarker({ id, n, onSelect }: { id: string; n: number; onSelect?: (id: string) => void }) {
  const interactive = !!onSelect
  return (
    <sup
      data-briefing-id={id}
      data-cite-number={n}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={`Source ${n}`}
      title={`Source ${n}`}
      onClick={interactive ? () => onSelect!(id) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect!(id)
              }
            }
          : undefined
      }
      style={{
        color: 'var(--ink-mute)',
        cursor: interactive ? 'pointer' : 'default',
        fontWeight: 500,
        padding: '0 1px',
      }}
    >
      {n}
    </sup>
  )
}

function MessageBody({
  role,
  content,
  citeNumbers,
  streaming,
  onSelectCite,
}: {
  role: 'user' | 'assistant'
  content: string
  citeNumbers: Record<string, number>
  streaming: boolean
  onSelectCite?: (id: string) => void
}) {
  const isAssistant = role === 'assistant'
  // Only assistant text carries citation tokens. User text renders verbatim.
  const segments: CiteSegment[] = isAssistant
    ? streaming
      ? parseStreaming(content)
      : parseFinal(content)
    : [{ type: 'text', value: content }]

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="t-caption-emph" style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
        {isAssistant ? 'Sentry' : 'You'}
      </div>
      {/* pre-wrap preserves newlines; text segments render literally, cites as markers */}
      <div className="t-body" style={{ color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
        {segments.map((seg, i) =>
          seg.type === 'text' ? (
            <span key={i}>{seg.value}</span>
          ) : citeNumbers[seg.id] !== undefined ? (
            // Unknown/not-yet-numbered ids render nothing (drop silently).
            <CiteMarker key={i} id={seg.id} n={citeNumbers[seg.id]} onSelect={onSelectCite} />
          ) : null
        )}
        {streaming && content.length === 0 ? (
          <span style={{ color: 'var(--ink-faint)' }}>…</span>
        ) : null}
      </div>
    </div>
  )
}

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  // Conversation-scoped, stable citation numbering: briefing id → number, first
  // appearance across the whole conversation. Shared by markers AND the pane.
  const [citeNumbers, setCiteNumbers] = useState<Record<string, number>>({})
  // Which assistant turn's sources the pane shows (null → latest), and which source row
  // is highlighted (set on marker click).
  const [focusedMsgIndex, setFocusedMsgIndex] = useState<number | null>(null)
  const [focusedSourceId, setFocusedSourceId] = useState<string | null>(null)

  const transcriptRef = useRef<HTMLDivElement>(null)
  const paneRef = useRef<HTMLDivElement>(null)

  // Keep the latest turn / streaming tokens in view.
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTo({ top: el.scrollHeight })
  }, [messages, streamingText])

  // Active assistant turn for the pane: the explicitly focused one if valid, else latest.
  const activeIndex =
    focusedMsgIndex !== null && messages[focusedMsgIndex]?.role === 'assistant'
      ? focusedMsgIndex
      : lastAssistantIndex(messages)
  const activeMsg = activeIndex >= 0 ? messages[activeIndex] : null
  const activeSources = activeMsg?.sources

  // Scroll the focused source into view within the pane.
  useEffect(() => {
    if (!focusedSourceId) return
    const el = paneRef.current?.querySelector(`[data-source-id="${focusedSourceId}"]`)
    if (el) (el as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusedSourceId, activeIndex])

  // Assign numbers to any not-yet-seen ids, in appearance order. Stable: an id already in
  // the map keeps its number; new ids get the next sequential numbers.
  const registerCites = (orderedIds: string[]) => {
    setCiteNumbers((prev) => {
      let next: Record<string, number> | null = null
      let n = Object.keys(prev).length
      for (const id of orderedIds) {
        if (!(id in prev) && (next === null || !(id in next))) {
          if (next === null) next = { ...prev }
          n += 1
          next[id] = n
        }
      }
      return next ?? prev
    })
  }

  const handleCiteSelect = (messageIndex: number, id: string) => {
    setFocusedMsgIndex(messageIndex)
    setFocusedSourceId(id)
  }

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return

    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setStreaming(true)
    setStreamingText('')
    // New answer: let the pane follow the latest turn again.
    setFocusedMsgIndex(null)
    setFocusedSourceId(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send ONLY { role, content } per message — strip `sources` (and any other extra
        // field) so the body matches the endpoint's isChatMessage validator exactly and no
        // trailer/control data or extra fields ever reach the model. Never a firm_id; the
        // firm is derived server-side. content is already cleanText (no sentinel/trailer).
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      })

      if (!res.ok || !res.body) {
        setMessages((m) => [...m, { role: 'assistant', content: ERROR_TEXT }])
        return
      }

      // Consume as a STREAM, demuxing on the sentinel: everything before it is transcript
      // text (rendered with live markers); the JSON trailer after it is buffered and parsed
      // at completion. Text streams delta-by-delta as before.
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        const sentIdx = acc.indexOf(SENTINEL)
        const textPart = sentIdx === -1 ? acc : acc.slice(0, sentIdx)
        setStreamingText(textPart)
        registerCites(citedIds(textPart))
      }
      acc += decoder.decode()

      // Single split of the final buffer (robust to the sentinel/JSON arriving across
      // chunks — parsed once, here, at completion):
      //   cleanText = everything BEFORE the first sentinel (whole buffer if none). This is
      //               the prose + [[cite:ID]] tokens that is PERSISTED as content and
      //               re-sent to the model next turn — never the sentinel or trailer.
      //   sources   = the parsed { sources } JSON AFTER the sentinel, kept SEPARATELY on
      //               the message for the provenance pane only.
      const sentIdx = acc.indexOf(SENTINEL)
      const cleanText = sentIdx === -1 ? acc : acc.slice(0, sentIdx)
      let sources: CitedSource[] = []
      if (sentIdx !== -1) {
        try {
          const parsed = JSON.parse(acc.slice(sentIdx + 1).trim()) as { sources?: CitedSource[] }
          if (Array.isArray(parsed.sources)) sources = parsed.sources
        } catch {
          sources = []
        }
      }
      registerCites(citedIds(cleanText))
      setMessages((m) => [
        ...m,
        // content is cleanText ONLY (no sentinel, no trailer); sources stored separately.
        { role: 'assistant', content: cleanText.length > 0 ? cleanText : ERROR_TEXT, sources },
      ])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: ERROR_TEXT }])
    } finally {
      setStreamingText('')
      setStreaming(false)
    }
  }

  const sortedSources =
    activeSources && activeSources.length > 0
      ? [...activeSources].sort((a, b) => (citeNumbers[a.id] ?? 0) - (citeNumbers[b.id] ?? 0))
      : []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', height: '100%' }}>
      {/* Centre: transcript + input */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          borderRight: '1px solid var(--hairline)',
        }}
      >
        <div ref={transcriptRef} style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {messages.length === 0 && !streaming ? (
            <p className="t-body" style={{ color: 'var(--ink-mute)', margin: 0, maxWidth: 560 }}>
              {EMPTY_PROMPT}
            </p>
          ) : null}

          {messages.map((m, i) => (
            <MessageBody
              key={i}
              role={m.role}
              content={m.content}
              citeNumbers={citeNumbers}
              streaming={false}
              onSelectCite={m.role === 'assistant' ? (id) => handleCiteSelect(i, id) : undefined}
            />
          ))}

          {streaming ? (
            <MessageBody
              role="assistant"
              content={streamingText}
              citeNumbers={citeNumbers}
              streaming
            />
          ) : null}
        </div>

        <div
          style={{
            borderTop: '1px solid var(--hairline)',
            padding: 16,
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter submits; Shift+Enter inserts a newline. No <form> element.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Ask about your briefings"
            rows={2}
            disabled={streaming}
            style={{
              flex: 1,
              resize: 'none',
              border: '1px solid var(--hairline)',
              padding: 8,
              background: 'var(--ground)',
              color: 'var(--ink)',
              fontFamily: 'inherit',
              fontSize: 14,
              lineHeight: '20px',
            }}
          />
          <button
            onClick={send}
            disabled={streaming || input.trim().length === 0}
            className="btn btn-primary"
            style={{ fontSize: 13 }}
          >
            {streaming ? 'Answering…' : 'Send'}
          </button>
        </div>
      </div>

      {/* Right: provenance pane — the numbered cited sources for the active answer. */}
      <aside ref={paneRef} style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
        <div className="t-caption-emph" style={{ color: 'var(--ink-mute)', marginBottom: 12 }}>
          Provenance
        </div>

        {activeSources === undefined ? (
          // No answered turn yet (or an error turn) — the initial placeholder.
          <p className="t-body" style={{ color: 'var(--ink-faint)', margin: 0 }}>
            Sources will appear here.
          </p>
        ) : sortedSources.length === 0 ? (
          <p className="t-body" style={{ color: 'var(--ink-faint)', margin: 0 }}>
            No sources cited for this answer.
          </p>
        ) : (
          sortedSources.map((s, idx) => {
            const num = citeNumbers[s.id]
            const isFocused = s.id === focusedSourceId
            return (
              <div
                key={s.id}
                data-source-id={s.id}
                style={{
                  padding: '12px 8px',
                  margin: '0 -8px',
                  borderTop: idx > 0 ? '1px solid var(--hairline)' : 'none',
                  background: isFocused ? 'var(--signal-tint)' : 'transparent',
                  transition: 'background 150ms ease-out',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                  <span className="t-caption-emph" style={{ color: 'var(--ink-mute)' }}>
                    {num ?? '·'}
                  </span>
                  <SourceTag agency={s.agency} sourceType={s.sourceType} />
                </div>
                <div className="t-body" style={{ color: 'var(--ink)', marginBottom: 4 }}>
                  {s.title}
                </div>
                {s.publishedAt ? (
                  <div className="t-caption" style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
                    Published {fmtDate(s.publishedAt)}
                  </div>
                ) : null}
                <div className="citation" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      View source document
                    </a>
                  ) : (
                    <span style={{ color: 'var(--ink-faint)' }}>Source link unavailable</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </aside>
    </div>
  )
}
