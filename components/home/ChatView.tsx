'use client'

import { useEffect, useRef, useState } from 'react'

// Chat island: in-memory multi-turn history (Decision 4a — lost on refresh; DB
// persistence is a later drop-in), streamed against POST /api/chat. The client sends
// ONLY { messages }; the firm is derived server-side from the session. Citation tokens
// [[cite:ID]] render as RAW TEXT at this stage (inline rendering is a later prompt).

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const EMPTY_PROMPT =
  "Ask about your firm's briefings. Sentry answers only from what has been filed, and cites each briefing it draws on."
const ERROR_TEXT = 'Something went wrong answering that.'

function Turn({
  role,
  content,
  pending,
}: {
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="t-caption-emph" style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
        {role === 'user' ? 'You' : 'Sentry'}
      </div>
      {/* pre-wrap renders newlines and the literal [[cite:ID]] tokens as raw text */}
      <div className="t-body" style={{ color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
        {content}
        {pending && content.length === 0 ? (
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
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Keep the latest turn / streaming tokens in view.
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTo({ top: el.scrollHeight })
  }, [messages, streamingText])

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

      // Consume the response as a STREAM — decode and append chunks as they arrive so
      // the in-progress assistant turn updates token-by-token (never buffered whole).
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setStreamingText(acc)
      }
      acc += decoder.decode()

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
            <Turn key={i} role={m.role} content={m.content} />
          ))}

          {streaming ? <Turn role="assistant" content={streamingText} pending /> : null}
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

      {/* Right: provenance pane slot — written placeholder for now (prompt 4 makes it live). */}
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
