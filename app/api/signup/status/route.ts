import { stripe } from '@/lib/stripe/client'
import { adminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// Public, unauthenticated poll endpoint for the /signup/success page. Reports only
// the provisioning state — never firm id, email, profile, or any customer data.
export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get('session_id')
  if (!sessionId) {
    return Response.json({ status: 'error' }, { status: 400 })
  }

  let subscriptionId: string | null
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id ?? null
  } catch {
    // Don't leak Stripe errors; the page keeps polling or times out.
    return Response.json({ status: 'error' }, { status: 200 })
  }

  if (!subscriptionId) {
    // Checkout isn't far enough along to have a subscription yet.
    return Response.json({ status: 'pending' }, { status: 200 })
  }

  // Service-role lookup: has the webhook provisioned the firm for this subscription?
  const { data: firm, error } = await adminClient
    .from('firms')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  if (error) {
    return Response.json({ status: 'error' }, { status: 200 })
  }

  // firm id is read for existence only — never returned.
  return Response.json({ status: firm ? 'ready' : 'pending' }, { status: 200 })
}
