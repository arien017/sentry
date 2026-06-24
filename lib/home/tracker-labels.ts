// Pure UI for the Tracker: shared row types + source/stage/date label helpers. No server
// imports (no createClient, no next/headers), so this is safe to import from client
// components — same boundary discipline as bands.ts. The materiality colour itself comes
// from the existing MaterialityDot / bands.ts scale; nothing new is invented here.

export type SourceType = 'regulator' | 'parliamentary'
export type ItemType = 'bill' | 'inquiry' | 'consultation' | 'instrument'
export type Stage =
  | 'introduced'
  | 'first_reading'
  | 'second_reading'
  | 'in_committee'
  | 'third_reading'
  | 'other_chamber'
  | 'assent'
  | 'consultation_open'
  | 'submissions_open'
  | 'inquiry_active'
  | 'sunsetting'
  | 'closed'
export type Band = 'Before Parliament' | 'In Progress' | 'Closing Soon' | 'Sunsetting' | 'Closed'

// Normalized tracker row shape (camelCase), shaped to tracker_items + the sources agency
// label. Lives here (pure) so both the server-fetch module and the client row import it
// without crossing the boundary.
export type TrackerItem = {
  id: string
  sourceId: string | null
  sourceType: SourceType
  itemType: ItemType
  stage: Stage
  title: string
  relevance: string | null
  materialityScore: number
  horizonDate: string | null
  windowOpens: string | null
  windowCloses: string | null
  url: string | null
  isClosed: boolean
  agency: string | null // from sources join; null for parliamentary rows
}

export type BandGroup = { band: Band; items: TrackerItem[] }

// Source tag (rendered in the existing .t-caption-emph caption style, which uppercases).
// Regulator rows: the agency, e.g. "APRA". Parliamentary rows (no sources row): derived
// from item_type, e.g. "Parliament · Bills" → "PARLIAMENT · BILLS".
const PARLIAMENT_ITEM_LABEL: Record<ItemType, string> = {
  bill: 'Bills',
  inquiry: 'Committees',
  consultation: 'Consultation',
  instrument: 'Instruments',
}

export function sourceTag(item: TrackerItem): string {
  if (item.sourceType === 'regulator' && item.agency) return item.agency
  return `Parliament · ${PARLIAMENT_ITEM_LABEL[item.itemType]}`
}

// Fine stage indicator shown on the row (the band is the group header).
const STAGE_LABEL: Record<Stage, string> = {
  introduced: 'Introduced',
  first_reading: 'First reading',
  second_reading: 'Second reading',
  in_committee: 'In committee',
  third_reading: 'Third reading',
  other_chamber: 'Other chamber',
  assent: 'Assented',
  consultation_open: 'Consultation open',
  submissions_open: 'Submissions open',
  inquiry_active: 'Inquiry active',
  sunsetting: 'Sunsets',
  closed: 'Closed',
}

export function stageLabel(stage: Stage): string {
  return STAGE_LABEL[stage] ?? stage
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Deterministic UTC formatting — avoids a server/client hydration mismatch.
export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

// The row's date display: a window renders as a range, a horizon as a single date.
export function formatWhen(item: TrackerItem): string {
  if (item.windowOpens && item.windowCloses) {
    return `${formatDate(item.windowOpens)} – ${formatDate(item.windowCloses)}`
  }
  if (item.horizonDate) return formatDate(item.horizonDate)
  if (item.windowCloses) return `Closes ${formatDate(item.windowCloses)}`
  if (item.windowOpens) return `Opens ${formatDate(item.windowOpens)}`
  return ''
}
