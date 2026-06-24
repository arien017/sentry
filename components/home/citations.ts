// Parser for the [[cite:BRIEFING_ID]] citation tokens emitted by /api/chat.
// Pure — no React, no server imports, safe in a client component. BRIEFING_ID is a
// briefings.id (UUID). Malformed cites (non-UUID content) are dropped. Stream-safe:
// parseStreaming holds back a trailing partial token so a half-formed marker never
// renders mid-stream.

export type CiteSegment = { type: 'text'; value: string } | { type: 'cite'; id: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN_RE = /\[\[cite:([^\]]*)\]\]/gi

// Split off a trailing substring that could be the start of an incomplete token: the last
// unterminated "[[", or a trailing "[" that might become "[[".
function splitSafe(text: string): { safe: string; tail: string } {
  const lastOpen = text.lastIndexOf('[[')
  if (lastOpen !== -1 && text.indexOf(']]', lastOpen) === -1) {
    return { safe: text.slice(0, lastOpen), tail: text.slice(lastOpen) }
  }
  if (text.endsWith('[')) {
    return { safe: text.slice(0, -1), tail: '[' }
  }
  return { safe: text, tail: '' }
}

// Parse all COMPLETE tokens in `text`. Valid (UUID) cites become cite segments; malformed
// cites are dropped; everything else (including non-cite "[[...]]") is text.
function parseComplete(text: string): CiteSegment[] {
  const segments: CiteSegment[] = []
  let last = 0
  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', value: text.slice(last, m.index) })
    const id = m[1].trim()
    if (UUID_RE.test(id)) segments.push({ type: 'cite', id })
    // else: malformed cite → drop (render nothing)
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) })
  return segments
}

// True if `tail` could be the prefix of an incomplete "[[cite:..." token.
function isPartialCite(tail: string): boolean {
  if (tail.length === 0) return false
  const lower = tail.toLowerCase()
  return '[[cite:'.startsWith(lower) || lower.startsWith('[[cite:')
}

// Streaming: render only the safe portion; the trailing partial is held back so a
// half-formed marker never appears on screen.
export function parseStreaming(text: string): CiteSegment[] {
  return parseComplete(splitSafe(text).safe)
}

// Finalised: parse the whole string. A leftover tail is dropped if it is an incomplete
// "[[cite:" token, otherwise rendered as text (ordinary prose such as "[[note]]").
export function parseFinal(text: string): CiteSegment[] {
  const { safe, tail } = splitSafe(text)
  const segments = parseComplete(safe)
  if (tail.length > 0 && !isPartialCite(tail)) {
    segments.push({ type: 'text', value: tail })
  }
  return segments
}

// The valid (UUID) briefing ids cited in `text`, in order of appearance. Used to assign
// stable per-conversation citation numbers (first appearance → next number).
export function citedIds(text: string): string[] {
  const ids: string[] = []
  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const id = m[1].trim()
    if (UUID_RE.test(id)) ids.push(id)
  }
  return ids
}
