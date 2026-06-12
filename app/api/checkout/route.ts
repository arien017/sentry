import { adminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'
import { TIER_PRICE_IDS, type Tier, type Interval } from '@/lib/stripe/pricing'

const VALID_TIERS: readonly Tier[] = ['essentials', 'standard', 'government']
const VALID_INTERVALS: readonly Interval[] = ['monthly', 'yearly']

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      profile?: unknown
      email?: unknown
      firmName?: unknown
      tier?: unknown
      interval?: unknown
    } | null

    if (
      !body ||
      typeof body.profile !== 'object' ||
      body.profile === null ||
      typeof body.email !== 'string' ||
      body.email.length === 0 ||
      typeof body.firmName !== 'string' ||
      body.firmName.length === 0 ||
      !VALID_TIERS.includes(body.tier as Tier) ||
      !VALID_INTERVALS.includes(body.interval as Interval)
    ) {
      return Response.json(
        {
          error:
            'Invalid body: require profile (object), email, firmName, tier (essentials|standard|government), interval (monthly|yearly)',
        },
        { status: 400 }
      )
    }

    const profile = body.profile as Record<string, unknown>
    const email = body.email
    const firmName = body.firmName
    const tier = body.tier as Tier
    const interval = body.interval as Interval

    const origin = req.headers.get('origin')
    if (!origin) {
      return Response.json({ error: 'Missing Origin header' }, { status: 400 })
    }

    // pending_signups is RLS-enabled with no policies (deny-all); only the
    // service-role client can write it. status defaults to 'pending'.
    const { data: signup, error: signupError } = await adminClient
      .from('pending_signups')
      .insert({ profile, firm_name: firmName, email, tier, interval })
      .select('id')
      .single()
    if (signupError || !signup) {
      throw new Error(`pending_signups insert failed: ${signupError?.message}`)
    }

    // Create the Customer first so the subscription Checkout creates is
    // attached to a known customer id.
    const customer = await stripe.customers.create({ email })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      // One line item: the tier price. Seats default to the 5 included in the
      // base tier; seat add-on line items come later.
      line_items: [{ price: TIER_PRICE_IDS[tier][interval], quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        // Must live on the Subscription object (not the session) so the
        // webhook can link the subscription back to the signup row.
        metadata: { pending_signup_id: signup.id },
      },
      success_url: `${origin}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/signup/cancelled`,
    })

    return Response.json({ url: session.url }, { status: 200 })
  } catch (err) {
    console.error('Checkout failed:', err)
    return Response.json({ error: 'Internal error creating checkout session' }, { status: 500 })
  }
}
