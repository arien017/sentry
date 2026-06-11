// Pure config: maps Sentry tiers and billing intervals to Stripe Price IDs.
// No side effects, no Stripe SDK, no I/O — safe to import anywhere server-side.

export type Tier = 'essentials' | 'standard' | 'government'
export type Interval = 'monthly' | 'yearly'

const REQUIRED_ENV_VARS = [
  'STRIPE_PRICE_ESSENTIALS_MONTHLY',
  'STRIPE_PRICE_ESSENTIALS_YEARLY',
  'STRIPE_PRICE_STANDARD_MONTHLY',
  'STRIPE_PRICE_STANDARD_YEARLY',
  'STRIPE_PRICE_GOVERNMENT_MONTHLY',
  'STRIPE_PRICE_GOVERNMENT_YEARLY',
  'STRIPE_PRICE_SEAT_MONTHLY',
  'STRIPE_PRICE_SEAT_YEARLY',
] as const

// Billing config missing in production must fail loudly at startup, not
// silently produce undefined Price IDs at checkout time.
const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name])
if (missing.length > 0) {
  throw new Error(`Missing Stripe billing env var(s): ${missing.join(', ')}`)
}

export const TIER_PRICE_IDS: Record<Tier, Record<Interval, string>> = {
  essentials: {
    monthly: process.env.STRIPE_PRICE_ESSENTIALS_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_ESSENTIALS_YEARLY!,
  },
  standard: {
    monthly: process.env.STRIPE_PRICE_STANDARD_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_STANDARD_YEARLY!,
  },
  government: {
    monthly: process.env.STRIPE_PRICE_GOVERNMENT_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_GOVERNMENT_YEARLY!,
  },
}

// Additional-seat add-on, billed as a separate subscription line item with a
// quantity. Stripe forbids mixing billing intervals on one subscription, so
// the seat Price interval MUST match the tier's interval (monthly tier →
// monthly seat Price; yearly tier → yearly seat Price).
export const SEAT_PRICE_IDS: Record<Interval, string> = {
  monthly: process.env.STRIPE_PRICE_SEAT_MONTHLY!,
  yearly: process.env.STRIPE_PRICE_SEAT_YEARLY!,
}

// Reverse lookup for the webhook: tier Price ID → tier. Derived from
// TIER_PRICE_IDS so the two can never drift. Seat Price IDs are deliberately
// absent — a seat line item is an add-on, not a tier.
export const PRICE_ID_TO_TIER: Record<string, Tier> = Object.fromEntries(
  (Object.entries(TIER_PRICE_IDS) as Array<[Tier, Record<Interval, string>]>).flatMap(
    ([tier, prices]) => Object.values(prices).map((priceId): [string, Tier] => [priceId, tier])
  )
)
