import type { createClient } from '@/lib/supabase/server'
import type { Band, BandGroup, ItemType, Stage, TrackerItem } from './tracker-labels'

// Re-export the row type from the pure module so callers can import it from here too
// (per the established briefings.ts surface). The TYPE lives in the pure tracker-labels
// module so client components import it without crossing the server boundary.
export type { TrackerItem } from './tracker-labels'

// The awaited SSR server client the home views build with createClient(). Type-only
// import — erased at compile time, so this module carries no server-only runtime dep.
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Raw shape of the nested PostgREST embed. No generated DB types in this repo, so we type
// the result explicitly and normalize the to-one sources embed (object | single-element
// array | null) defensively. sources is a LEFT join: parliamentary rows (source_id null)
// come back with sources = null.
interface RawSource {
  agency: string | null
}
interface RawTrackerItem {
  id: string
  source_id: string | null
  source_type: string
  item_type: string
  stage: string
  title: string
  relevance: string | null
  materiality_score: number
  horizon_date: string | null
  window_opens: string | null
  window_closes: string | null
  url: string | null
  is_closed: boolean
  sources: RawSource | RawSource[] | null
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

export function normalizeTrackerRow(raw: RawTrackerItem): TrackerItem {
  const src = one(raw.sources)
  return {
    id: raw.id,
    sourceId: raw.source_id,
    sourceType: raw.source_type === 'parliamentary' ? 'parliamentary' : 'regulator',
    itemType: raw.item_type as ItemType,
    stage: raw.stage as Stage,
    title: raw.title,
    relevance: raw.relevance,
    materialityScore: raw.materiality_score,
    horizonDate: raw.horizon_date,
    windowOpens: raw.window_opens,
    windowCloses: raw.window_closes,
    url: raw.url,
    isClosed: raw.is_closed,
    agency: src?.agency ?? null,
  }
}

// RLS-scoped fetch of the session firm's tracker_items, LEFT JOINing sources for the
// agency label. The firm is derived from the session via RLS (firm_id = auth_firm_id());
// no firm_id is passed. FK inference: tracker_items.source_id → sources.id is a single FK,
// so the plain `sources ( agency )` embed (no !inner = LEFT join) resolves; if PostgREST
// ever errors on inference, hint it: sources!tracker_items_source_id_fkey ( agency ).
export async function fetchTrackerItems(supabase: SupabaseServerClient): Promise<TrackerItem[]> {
  const { data, error } = await supabase
    .from('tracker_items')
    .select(
      `
        id,
        source_id,
        source_type,
        item_type,
        stage,
        title,
        relevance,
        materiality_score,
        horizon_date,
        window_opens,
        window_closes,
        url,
        is_closed,
        sources (
          agency
        )
      `
    )
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as unknown as RawTrackerItem[]).map(normalizeTrackerRow)
}

// --- band derivation ---------------------------------------------------------
export const BAND_ORDER: Band[] = [
  'Before Parliament',
  'In Progress',
  'Closing Soon',
  'Sunsetting',
  'Closed',
]

const MS_DAY = 86_400_000
const CLOSED_STAGES = new Set<Stage>(['assent', 'closed'])
const BEFORE_STAGES = new Set<Stage>(['introduced', 'first_reading', 'consultation_open'])
const IN_PROGRESS_STAGES = new Set<Stage>([
  'second_reading',
  'in_committee',
  'third_reading',
  'other_chamber',
  'inquiry_active',
  'submissions_open',
])

function startOfToday(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

// Parse a 'YYYY-MM-DD' (or ISO) date to local midnight, date-only (no time-of-day).
function toLocalMidnight(dateStr: string): Date | null {
  const m = dateStr.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function closeDateOf(item: TrackerItem): string | null {
  return item.windowCloses ?? item.horizonDate
}

// EXACT six-branch order (verified): Closed overrides everything; Closing Soon (closeDate
// within [today, today+14] inclusive) overrides the stage-based bands. `today` is computed
// once per request (passed in by groupByBand) and compared date-only.
export function bandOf(item: TrackerItem, today: Date = startOfToday()): Band {
  if (item.isClosed || CLOSED_STAGES.has(item.stage)) return 'Closed'

  const close = closeDateOf(item)
  if (close !== null) {
    const d = toLocalMidnight(close)
    if (d) {
      const days = Math.round((d.getTime() - today.getTime()) / MS_DAY)
      if (days >= 0 && days <= 14) return 'Closing Soon'
    }
  }

  if (item.stage === 'sunsetting') return 'Sunsetting'
  if (BEFORE_STAGES.has(item.stage)) return 'Before Parliament'
  if (IN_PROGRESS_STAGES.has(item.stage)) return 'In Progress'
  return 'In Progress' // fallback
}

// Group normalized items by band, returning only non-empty bands in display order. Each
// group is sorted by closeDate ascending (nulls last), then materiality_score descending.
export function groupByBand(items: TrackerItem[], today: Date = startOfToday()): BandGroup[] {
  const buckets = new Map<Band, TrackerItem[]>()
  for (const item of items) {
    const band = bandOf(item, today)
    const arr = buckets.get(band)
    if (arr) arr.push(item)
    else buckets.set(band, [item])
  }

  const groups: BandGroup[] = []
  for (const band of BAND_ORDER) {
    const arr = buckets.get(band)
    if (!arr || arr.length === 0) continue
    arr.sort((a, b) => {
      const ca = closeDateOf(a)
      const cb = closeDateOf(b)
      if (ca !== cb) {
        if (ca === null) return 1 // nulls last
        if (cb === null) return -1
        return ca < cb ? -1 : 1 // ISO date strings sort chronologically
      }
      return b.materialityScore - a.materialityScore
    })
    groups.push({ band, items: arr })
  }
  return groups
}
