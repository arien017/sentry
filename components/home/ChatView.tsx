'use client'

import { useEffect, useRef, useState } from 'react'
import { parseStreaming, parseFinal, citedIds, type CiteSegment } from './citations'

// Chat island: in-memory multi-turn history (Decision 4a — lost on refresh; DB
// persistence is a later drop-in), streamed against POST /api/chat. The client sends
// ONLY { messages }; the firm is derived server-side from the session.
//
// Citations: assistant text carries [[cite:BRIEFING_ID]] tokens. They render as
// superscript footnote markers numbered PER-CONVERSATION and STABLY — each distinct
// briefing id is numbered on first appearance anywhere in the conversation and keeps that
// number in every later message. The id→number map (citeNumbers) is conversation-scoped
// state, persistence-ready. Marker click-to-focus is wired to the provenance pane later.

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const EMPTY_PROMPT =
  "Ask about your firm's briefings. Sentry answers only from what has been filed, and cites each briefing it draws on."
const ERROR_TEXT = 'Something went wrong answering that.'

// Restrained scholarly footnote marker. Carries id + number as data so the provenance
// pane (a later step) can wire click-to-focus; the click is a no-op for now.
function CiteMarker({ id, n }: { id: string; n: number }) {
  return (
    <sup
      data-briefing-id={id}
      data-cite-number={n}
      role="button"
      tabIndex={0}
      aria-label={`Source ${n}`}
      title={`Source ${n}`}
      onClick={() => {
        // Click-to-focus the provenance pane is wired in a later step.
      }}
      onKeyDown={(e) => {
        // Keyboard activation is wired with the click behaviour in a later step.
        if (e.key === 'Enter' || e.key === ' ') e.preventDefault()
      }}
      style={{ color: 'var(--ink-mute)', cursor: 'pointer', fontWeight: 500, padding: '0 1px' }}
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
}: {
  role: 'user' | 'assistant'
  content: string
  citeNumbers: Record<string, number>
  streaming: boolean
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
            <CiteMarker key={i} id={seg.id} n={citeNumbers[seg.id]} />
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
  // Conversation-scoped, stable citation numbering: briefing id → number, assigned in
  // order of first appearance across the whole conversation.
  const [citeNumbers, setCiteNumbers] = useState<Record<string, number>>({})
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Keep the latest turn / streaming tokens in view.
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTo({ top: el.scrollHeight })
  }, [messages, streamingText])

  // Assign numbers to any not-yet-seen ids, in the given appearance order. Stable: an id
  // already in the map keeps its number; new ids get the next sequential numbers.
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

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return

    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setStreaming(true)
    setStreamingText('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ONLY messages — never a firm_id; the firm is derived server-side.
        body: JSON.stringify({ messages: next }),
      })

      if (!res.ok || !res.body) {
        setMessages((m) => [...m, { role: 'assistant', content: ERROR_TEXT }])
        return
      }

      // Consume the response as a STREAM — decode and append chunks as they arrive so the
      // in-progress assistant turn updates token-by-token (never buffered whole). Numbers
      // are registered as complete citations stream in, so markers appear live.
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setStreamingText(acc)
        registerCites(citedIds(acc))
      }
      acc += decoder.decode()
      registerCites(citedIds(acc))

      setMessages((m) => [...m, { role: 'assistant', content: acc.length > 0 ? acc : ERROR_TEXT }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: ERROR_TEXT }])
    } finally {
      setStreamingText('')
      setStreaming(false)
    }
  }

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

      {/* Right: provenance pane slot — written placeholder for now (a later step makes it live). */}
      <aside style={{ padding: 24 }}>
        <div className="t-caption-emph" style={{ color: 'var(--ink-mute)', marginBottom: 12 }}>
          Provenance
        </div>
        <p className="t-body" style={{ color: 'var(--ink-faint)', margin: 0 }}>
          Sources will appear here.
        </p>
      </aside>
    </div>
  )
}
