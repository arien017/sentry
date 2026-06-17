# Sentry — Session handover #8

**Date:** 17 June 2026
**Covers:** Week 7 close-out: wiring the marketing pricing button to `/api/checkout`
via an interim signup panel, and building the full magic-link sign-in path
(callback, login, magic-link sender, placeholder home) plus a welcome email from the
webhook. Proven end-to-end: checkout → provision → magic link → session → `/home`.
**Previous handover:** sentry-handover-7.md (return path: webhook + post-checkout routes)

**Numbering note:** in-repo handover #8. The handover/session divergence noted since #6
still stands (the TGA adapter handover remains missing from the collated set).

---

## What was done this session

Handover #7 left two gaps: the marketing pricing button was an inert placeholder (the
forward path was only curl-driven), and there was no way to sign in (auth identities
existed but no login route or email). This session closed both. The flow is now
clickable from the pricing card through to an authenticated `/home`.

### Pricing button → `/api/checkout` (`components/MarketingSite.tsx`)
- The CTA button inside `PricingCard` had no `onClick`. Wired it to open a small
  **interim signup panel** rendered inside the card (not a modal, no new component, no
  new file) — all changes scoped to the `PricingCard` function.
- The panel collects **email + firm name** with `useState`, then POSTs to
  `/api/checkout` and redirects to the returned Stripe `url` via
  `window.location.href`.
- Body mapping, recorded because it is easy to get wrong:
  - `tier = plan.id` (the plan ids are already lowercase `essentials|standard|government`,
    matching the `Tier` literals).
  - **`interval`: billing `"annual"` → `"yearly"`** (the UI toggle says "annual"; the
    route and `pricing.ts` require `"yearly"` — sending `"annual"` 400s).
  - **`profile: {}`** — a STUB. The onboarding chat will supply the real firm profile
    later; for now the firm provisions with an empty `firm_profiles.attributes`.
- Validates email + firm name non-empty client-side; surfaces the route's error message
  on failure; disables the confirm button and reads "Starting…" while in flight.
- **Tested in-browser**: clicking a plan, entering details, and confirming redirects to
  the correct Stripe checkout for the selected tier/interval. The interim panel is
  explicitly a placeholder for the onboarding chat.
- Styling uses only existing tokens; no `<form>` tag (plain `<div>` + button handlers).

### Magic-link sign-in path (four files + webhook email)
- `app/auth/callback/route.ts` — GET handler. Reads `token_hash` + `type` from the
  query, builds the SSR server client (`createClient` from `@/lib/supabase/server`,
  i.e. `@supabase/ssr` `createServerClient` wired to awaited `cookies()`), calls
  `verifyOtp({ type, token_hash })`. Success → `/home`; missing params or error →
  `/login?error=invalid_link`. Redirects built from `req.url` (no hardcoded host).
- `app/login/page.tsx` — client component. One email input + "Send sign-in link" button
  that POSTs to `/api/auth/magic-link`. States: idle / sending / sent / error; shows the
  `?error=invalid_link` notice at top when present. `useSearchParams` wrapped in
  `<Suspense>`. No `<form>`. Witness-register copy.
- `app/api/auth/magic-link/route.ts` — POST. Returning user requests a fresh link.
  Derives `origin` from `new URL(req.url).origin`, calls
  `generateLink({ type: 'magiclink', email, options: { redirectTo: …/auth/callback } })`,
  builds the link itself from `hashed_token` (see decision below), sends via Resend.
  **Never leaks account existence**: a non-existent user (generateLink throws) and any
  other error are caught, logged server-side, and STILL return `200 { ok: true }`. Never
  500s to the client. The only non-200 is a 400 for a missing email.
- `app/home/page.tsx` — placeholder authenticated home, server component. SSR client
  `getUser()`; no user → redirect `/login`. Looks up the firm via the `users` row
  (service-role) → `firms.name`. Renders `.t-title` "Sentry", "Signed in as {email}",
  "Firm: {name}". Nothing else — the real agentic home replaces it next session.
- **Webhook welcome email** (`app/api/stripe/webhook/route.ts`): inserted a NON-FATAL
  send AFTER the step 9 consume and BEFORE the step 10 return, in its own try/catch that
  logs and never rethrows (a throw here would make Stripe retry a completed
  provisioning). Placed after the consume so any retry hits the "already consumed"
  branch (step 3) first — the email sends at most once. `origin` threaded in from
  `POST()` as a parameter (no `req` in scope inside the handler). Provisioning steps 1–9
  are byte-identical. Resend SDK installed; `RESEND_API_KEY` + `RESEND_FROM` added to
  `.env.local` by hand.

### End-to-end proof
- checkout → webhook provision → welcome email → click link → `/auth/callback` →
  `verifyOtp({ type, token_hash })` → cookie session set → `/home` rendering the signed-in
  email and the firm name. The full forward+return+sign-in loop runs.

---

## Key technical decision — record prominently, do NOT reverse

**Magic links use the `token_hash` + `verifyOtp` flow, NOT `exchangeCodeForSession`.**

Supabase's `action_link` with `type=magiclink` redirects via the implicit/HASH flow:
the token lands in the URL fragment (`#…`), which never reaches a server callback, and
no `?code=` query param is delivered to a server route either. So
**`action_link` + `exchangeCodeForSession` does NOT compose** — the callback sees no
`code` and every link fails to `/login?error=invalid_link`. (This session burned an
iteration on exactly that mis-pairing: first `action_link` + `token_hash`/`verifyOtp`,
then a wrong "fix" to `action_link` + `exchangeCodeForSession`, before landing here.)

**The fix, in both email senders:** do not use `data.properties.action_link`. Read
`data.properties.hashed_token` and build the link yourself:

```
${origin}/auth/callback?token_hash=${hashed_token}&type=magiclink
```

— pointing at OUR callback, not Supabase's `/auth/v1/verify`. The callback then calls
`verifyOtp({ type, token_hash })`, which validates server-side and sets the session
cookie. Both senders (the magic-link route AND the webhook welcome email) construct the
link identically. **Do not reintroduce `exchangeCodeForSession` for magic links.**

---

## Decisions made

- **Magic-link flow = `token_hash` + `verifyOtp`** (above), with both senders
  self-constructing the callback link from `hashed_token`. Never `action_link` +
  `exchangeCodeForSession`.
- **Interim signup panel, not the onboarding chat yet.** The pricing button opens a
  minimal email + firm-name panel and sends `profile: {}`. The real profile capture is
  the onboarding chat, deferred.
- **Welcome email stays non-fatal and after the consume.** Email failure logs and still
  returns 200; placement after step 9 keeps it at-most-once under Stripe retries.

---

## Open items / next session

1. **The real agentic home** (Today / Alerts / Archive / Chat) — the platform UI begins
   here now that auth exists to reach it. `/home` is a placeholder.
2. **The Tracker** (forward-horizon view) — still unbuilt.
3. **Customer portal** (`Manage billing` → Stripe portal session) — still on the
   backlog, Week 7 piece three, unbuilt.
4. **Owned Resend sending domain** (launch blocker for sign-in, below) — verify a domain
   and send from `noreply@<domain>` instead of the `resend.dev` shared sender.
5. **Escape `firm_name` in the welcome email HTML** — small hardening (below).

---

## Carried from before (unchanged)

- **Welcome-email `firm_name` is interpolated unescaped** into the email HTML. Low risk
  (self-addressed to the buyer), but a name containing `&` or `<` renders wrong. Small
  hardening item — escape before interpolation.
- **Sign-in is built but cannot deliver to Gmail in practice** via the `resend.dev`
  shared sender (see Lessons). The code path is proven; delivery needs an owned domain.
- **Summariser line-trace incomplete:** 4 of 6 APRA briefings untraced; the ADI
  licensing consultation (hard "31 July 2026" date) is the priority. Also owed: eyeball
  TGA summaries for fabricated specifics, and one genuinely ambiguous classifier test.
- **Marketing fabrications** (stat strip, trusted-by strip, placeholder quotes):
  spec-mandated for removal before any real launch.
- **AUSTRAC** still deferred; RSS is dead, requires an HTML scrape adapter.
- **Migration history repair** before any future `supabase db push`: still includes
  `20260612100000` and `20260616090000`.

---

## Lessons this session (the time-sinks, so they don't recur)

- **`stripe listen` must be running for ANY local webhook test.** With it not running,
  webhooks never fire and nothing provisions — silent, looks like the handler is broken
  when in fact nothing is being delivered. RULE:
  `stripe listen --forward-to localhost:3000/api/stripe/webhook` must be up for every
  local webhook test, and its rotating `whsec_` re-copied into `.env.local` with a dev
  server restart (carried from #7, bit again this session).
- **Gmail silently DROPS the `resend.dev` shared test sender.** Resend's dashboard
  reports "Delivered" but the email never appears in Gmail — the shared sender has no
  domain authentication, so Gmail discards it without a bounce. All email testing this
  session required pulling the link out of the Resend dashboard's logged HTML body.
  LAUNCH-TIME FIX: verify an owned sending domain in Resend and send from
  `noreply@<domain>`. Until then, "Delivered" in Resend ≠ "arrived in inbox."
- **`action_link` ≠ a server-callback link** (the decision above): the Supabase-hosted
  verify URL redirects via the hash flow and never hands a server route a `code` or
  `token_hash`. Build the callback link yourself from `hashed_token`.

---

## Current state summary

- **Forward checkout path:** built, tested, **clickable end-to-end in the browser** (the
  pricing button now opens the signup panel and redirects to Stripe).
- **Return path (webhook):** provisions + lifecycle sync + welcome email, proven.
- **Sign-in path:** built and proven via `verifyOtp`/`token_hash`; reaches the
  placeholder `/home` showing email + firm name. Delivery to Gmail blocked on an owned
  Resend domain (code path proven via the Resend dashboard link).
- **NOT yet built:** the real agentic home (Today/Alerts/Archive/Chat), the Tracker, the
  customer portal.
- **Next session:** the platform UI begins with the agentic home — auth now exists to
  reach it.
- **Design spec:** v0.2 canonical. **Agent rules:** CLAUDE.md + AGENTS.md.
- **Pipeline:** TGA + APRA adapters unchanged and live.
- **Commit/push:** this session's changes (the `PricingCard` panel, the four sign-in
  files, the webhook welcome-email block, the `resend` dependency, and this handover) are
  built and tested; staging/committing is the founder's manual step per CLAUDE.md.
