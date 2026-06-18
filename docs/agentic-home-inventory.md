# Agentic Home — pre-build repo inventory

**Date:** 18 June 2026
**Purpose:** Read-only inventory of the repo before building the agentic home
(Today / Alerts / Archive / Chat / Tracker). Records exact paths, env vars,
design tokens/classes, and the existing data-fetch patterns new views must match.
No code was changed to produce this.

---

## 1. Route / home structure

`app/home/` contains exactly one file:

```
app/home/
app/home/page.tsx
```

Sub-route existence:

| Path | Status |
|---|---|
| `app/home/layout.tsx` | ABSENT |
| `app/home/today/` | ABSENT |
| `app/home/alerts/` | ABSENT |
| `app/home/archive/` | ABSENT |
| `app/home/chat/` | ABSENT |
| `app/home/tracker/` | ABSENT |

No layout, no nested segments — just the placeholder page. Other `app/` routes:
`app/page.tsx`, `app/admin/recent/page.tsx`, `app/login/page.tsx`,
`app/signup/{success,cancelled}/page.tsx`, `app/auth/callback/route.ts`, plus the
API routes under `app/api/`.

The agentic home is **greenfield**: a left rail + view segments would all be new.

---

## 2. Components

`components/` contains exactly one file:

```
components/
components/MarketingSite.tsx
```

- `components/home/` — **ABSENT**. No component subdirectory exists; there is no
  shared/reusable component library.
- No standalone/exported `LeftRail`, `SourceTag`, `MaterialityDot`, `BriefingList`,
  or `ProvenancePane`.

**Close functional equivalents exist as private (non-exported) inner functions inside
`components/MarketingSite.tsx`**, bound to a hardcoded `sampleItem` — reusing them in
the real home is a refactor (extract + parameterise off live rows), not a copy:

| Concept | Match | Location | What it does |
|---|---|---|---|
| LeftRail / nav rail | none | — | No left rail anywhere (marketing has a top nav only) |
| SourceTag / regulator tag | `TagRow` (partial) | `MarketingSite.tsx:60` | Renders `<span className="t-caption-emph">{regulator}</span>` + timestamp + materiality label; the source tag is just the `t-caption-emph` class |
| MaterialityDot | `matColor()` + `.mat-dot` | `MarketingSite.tsx:56` / usage `:63` | `matColor` maps `high/elevated/routine` → `--mat-*`; the dot is the `.mat-dot` CSS class |
| BriefingList / briefing row | `DigestItem` | `MarketingSite.tsx:104` | One briefing: `TagRow` + `t-heading` title + summary + optional `Interpretation` + `CitationBlock` |
| ProvenancePane / citation | `CitationBlock` | `MarketingSite.tsx:89` | `.citation` block: id, source URL `<a>`, anchor list |
| Firm interpretation | `Interpretation` | `MarketingSite.tsx:77` | `.interp` block, label "What this means for your firm" |

The `Briefing`, `Citation`, `Materiality` TS types are also local to `MarketingSite.tsx`
(`:8–25`).

---

## 3. Supabase clients

`lib/supabase/` contains:

```
lib/supabase/admin.ts
lib/supabase/client.ts
lib/supabase/server.ts
```

**`lib/supabase/admin.ts`:**

```ts
// SERVER-ONLY — never import this into a client component.
import { createClient } from '@supabase/supabase-js'

export const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
```

**`lib/supabase/client.ts`:**

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**`lib/supabase/server.ts`:**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch { /* setAll called from a Server Component — safe to ignore */ }
        },
      },
    }
  )
}
```

| File | Export | Auth mode | Env vars read |
|---|---|---|---|
| `admin.ts` | `adminClient` (ready instance) | Service-role (bypasses RLS) | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `client.ts` | `createClient` (factory) | Anon key, browser | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `server.ts` | `createClient` (async factory) | Anon key + SSR cookies (carries the session) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

Service-role/admin client: **exists**, named export **`adminClient`** in `lib/supabase/admin.ts`
(a constructed instance, not a factory). Conventionally imported as
`import { adminClient as supabaseAdmin } from '@/lib/supabase/admin'`. Carries a
`// SERVER-ONLY` warning.

---

## 4. Design tokens / styling

All tokens live in **`app/globals.css`** (Tailwind v4 via `@import "tailwindcss"`).
There is **no `tailwind.config.*`** (config-less v4) and **no separate tokens file**.
`postcss.config.mjs` exists but defines no tokens.

### Colours (`:root`)
- Ground/ink: `--ground` `#f7f8fa`, `--ground-raised` `#ffffff`, `--ink` `#0f1115`,
  `--ink-mute` `#6b6f76`, `--ink-faint` `#a3a6ab`
- Hairline/border: `--hairline` `#e2e4e8`, `--hairline-strong` `#c9ccd2`
- Signal (brand): `--signal` `#14365e`, `--signal-hover` `#0e2747`, `--signal-tint` `#e8edf4`
- **Materiality scale:** `--mat-high` `#c03a2e`, `--mat-elevated` `#d69517`,
  `--mat-routine` `#6b6f76`, `--mat-acknowledged` `#1f5a52`

All are also re-exposed as Tailwind theme colours via `@theme inline` (`--color-ground`,
`--color-ink`, `--color-mat-high`, …).

### Fonts
`--display-font` (Space Grotesk), `--body-font` (Inter), `--mono-font` (JetBrains Mono),
each wrapping the Next-injected `--font-display` / `--font-body` / `--font-mono`.

### Spacing / radius / motion
- **Spacing scale:** none. No `--space-*` tokens — all spacing is inline numeric literals.
- **Border-radius:** no radius tokens. Literals only: `.btn { border-radius: 4px }`,
  `.mat-dot { border-radius: 50% }`.
- **Motion:** no motion token. Single inline transition on `.btn`:
  `150ms ease-out` (the only timing used anywhere).

### Typography classes
| Class | Maps to |
|---|---|
| `.t-display` | display font, 500, 40/48, `-0.05em` |
| `.t-title` | display font, 500, 24/32, `-0.03em` |
| `.t-heading` | display font, 500, 18/26, `-0.02em` |
| `.t-body` | 15/24, `-0.011em` |
| `.t-body-emph` | 15/24, `-0.011em`, weight 500 |
| `.t-caption` | 13/20, `0.01em`, `--ink-mute` |
| `.t-caption-emph` | 12/20, weight 500, `0.06em`, **uppercase**, `--ink-mute` |
| `.t-mono` | mono font, 13/20 |

Component classes also in globals.css: `.btn` / `.btn-primary`; `.mat-dot` (+ `.mat-dot-8`,
`.mat-dot.high/.elevated/.routine/.acknowledged`); `.citation` (+ `.citation a`);
`.interp` / `.interp-label`.

**Caption-emphasis-uppercase for source tags:** exists — the exact class is
**`.t-caption-emph`** (12px, weight 500, letter-spacing `0.06em`, uppercase, `--ink-mute`).
No dedicated `.source-tag` class; `t-caption-emph` is the source-tag style.

Note: the CSS already includes `--mat-acknowledged` / `.mat-dot.acknowledged`, which the
marketing sample never uses — the design layer is ready for an acknowledged/actioned state.

---

## 5. Model strings (`claude-opus`)

**Code call-site (1):**
- `lib/llm/summarise.ts:33` → `model: 'claude-opus-4-7',` — the only `claude-opus`
  literal in executable code (the summariser; targets 4.8 per CLAUDE.md, runs 4.7 due
  to key access).

**Docs / rules / handovers (mentions, not call-sites):**
- `CLAUDE.md:46`
- `docs/sentry-handover-3.md:114`, `docs/sentry-handover-3.md:163`
- `docs/sentry-handover-4.md:99`

Sibling (not matched by `claude-opus`): the classifier string
`claude-haiku-4-5-20251001` lives in `lib/llm/classify.ts` and is referenced in
`lib/inngest/functions.ts`.

---

## 6. Existing data-fetch patterns

### A. Authenticated view — `app/home/page.tsx` (the pattern new views should match)

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient as supabaseAdmin } from "@/lib/supabase/admin";

export default async function HomePage() {
  // 1. SSR session client (anon key + cookies) identifies the user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { redirect("/login"); }

  // 2. Service-role client resolves the firm from the auth user id
  const { data: userRow } = await supabaseAdmin
    .from("users").select("firm_id").eq("id", user.id).maybeSingle();

  let firmName: string | null = null;
  if (userRow?.firm_id) {
    const { data: firm } = await supabaseAdmin
      .from("firms").select("name").eq("id", userRow.firm_id).maybeSingle();
    firmName = firm?.name ?? null;
  }
  // 3. render …
}
```

**Auth → firm resolution shape:** `createClient()` from `@/lib/supabase/server` →
`auth.getUser()` → `redirect("/login")` if absent → `supabaseAdmin` (service-role)
`.from("users").select("firm_id").eq("id", user.id).maybeSingle()` → then
`.from("firms").select("name").eq("id", userRow.firm_id).maybeSingle()`. Two sequential
single-row lookups keyed off `user.id`.

### B. Service-role-only view (no auth) — `app/admin/recent/page.tsx`

```ts
export const dynamic = 'force-dynamic'
import { adminClient } from '@/lib/supabase/admin'

export default async function RecentPublicationsPage() {
  const { data, error } = await adminClient
    .from('publications')
    .select('id, title, source_type, published_at, ingested_at, url')
    .order('ingested_at', { ascending: false })
    .limit(10)
  // error branch, empty branch, then table render
}
```

Uses `export const dynamic = 'force-dynamic'`, imports `adminClient` directly (no alias),
no auth gate, explicit error/empty handling. Corpus-read pattern (no firm scoping);
bypasses RLS via service-role.

---

## Observations (for the build, not yet actioned)

- The agentic home is greenfield: no `app/home/layout.tsx`, no sub-segments, no
  `components/home/`. Left rail + view segments (`today/alerts/archive/chat/tracker`)
  are all new.
- The briefing-row / materiality-dot / source-tag / citation primitives exist visually
  but are trapped as private functions in `MarketingSite.tsx`, bound to a hardcoded
  sample. Reuse = extract into `components/` (likely `components/home/`) and parameterise
  off live `briefings` / `classifications` / `publications` rows.
- The CSS materiality vocabulary is complete (`.mat-dot` + `--mat-*`, including the unused
  `--mat-acknowledged`), so the design layer already supports an acknowledged/actioned state.
- Auth gating exists exactly once (`home` via `getUser()`). Any new `/home/*` segment must
  repeat that gate, or an `app/home/layout.tsx` could centralise it (design choice).
