// Singleton Stripe client. Instantiation only — server-only, no other logic.
import Stripe from 'stripe'

// Same loud-failure rule as pricing.ts: billing config missing in production
// must fail at startup, not at checkout time.
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY env var')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
