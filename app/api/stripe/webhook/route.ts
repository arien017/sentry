import type Stripe from 'stripe'
import { Resend } from 'resend'
import { stripe } from '@/lib/stripe/client'
import { adminClient as supabaseAdmin } from '@/lib/supabase/admin'
import { PRICE_ID_TO_TIER } from '@/lib/stripe/pricing'

// Needs the raw request body and node crypto for signature verification — not edge.
export const runtime = 'nodejs'

export async function POST(req: Request) {
  // NEVER req.json() — it re-encodes the body and breaks the signature check.
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig!, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return new Response('bad signature', { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed':
      // origin is derived from the request (never hardcoded) for the welcome-email links.
      return handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
        new URL(req.url).origin
      )
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return handleSubscriptionLifecycle(event.type, event.data.object as Stripe.Subscription)
    default:
      // Acknowledge and ignore everything we didn't subscribe to.
      return new Response('ignored', { status: 200 })
  }
}

// ---------------------------------------------------------------------------
// checkout.session.completed — provisions the firm.
//
// BUILD-LAST ORDERING: every write below is conflict-safe, and the signup is
// only marked 'consumed' at the very end (step 9). If any step 5–8 throws, the
// signup stays 'pending', we return 500, and Stripe's retry re-runs the whole
// handler cleanly. Do not move the consume earlier.
// ---------------------------------------------------------------------------
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  origin: string
): Promise<Response> {
  try {
    if (!session.subscription) {
      console.error('checkout.session.completed with no subscription; session:', session.id)
      return new Response('no subscription', { status: 200 })
    }

    // 1. Retrieve the subscription with the price expanded.
    const sub = await stripe.subscriptions.retrieve(session.subscription as string, {
      expand: ['items.data.price'],
    })

    // 2. Resolve the pending_signup_id from either location.
    const pendingSignupId =
      session.metadata?.pending_signup_id ?? sub.metadata?.pending_signup_id
    if (!pendingSignupId) {
      console.error('No pending_signup_id on session or subscription; session:', session.id)
      return new Response('no pending_signup_id', { status: 200 })
    }

    // 3. READ the signup without consuming it. If it's already gone (consumed by
    //    a prior delivery), this is a duplicate — ack and stop (idempotent).
    const { data: signup, error: signupReadError } = await supabaseAdmin
      .from('pending_signups')
      .select('profile, firm_name, email, tier, interval')
      .eq('id', pendingSignupId)
      .eq('status', 'pending')
      .maybeSingle()
    if (signupReadError) throw signupReadError
    if (!signup) {
      return new Response('already consumed', { status: 200 })
    }

    // 4. Derive values. Re-derive tier from Stripe (source of truth); fall back to
    //    the row's tier only if the price isn't in our map.
    const priceId = sub.items.data[0].price.id
    const tier = PRICE_ID_TO_TIER[priceId] ?? signup.tier
    const status = sub.status
    // trial_end is UNIX SECONDS — the *1000 to milliseconds is mandatory.
    const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null

    // 5. Provision the firm via pre-select-then-insert. The unique index on
    //    stripe_subscription_id is PARTIAL (WHERE … IS NOT NULL), which supabase-js's
    //    onConflict cannot match (Postgres would throw 42P10), so we don't use upsert.
    //    NOTE: firms has `name` (NOT NULL); the captured name lives on
    //    pending_signups.firm_name — mapped here.
    let firmId: string
    const { data: existingFirm, error: firmLookupError } = await supabaseAdmin
      .from('firms')
      .select('id')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle()
    if (firmLookupError) throw firmLookupError

    if (existingFirm) {
      // Firm already provisioned by a prior delivery — reuse it (idempotent).
      firmId = existingFirm.id
    } else {
      // Plain insert. If a concurrent double-delivery wins the race, this throws a
      // unique violation → propagates to the outer catch → 500 → Stripe retries, and
      // the select above finds the row on the retry.
      const { data: insertedFirm, error: firmInsertError } = await supabaseAdmin
        .from('firms')
        .insert({
          name: signup.firm_name,
          tier,
          subscription_status: status,
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          trial_ends_at: trialEndsAt,
        })
        .select('id')
        .single()
      if (firmInsertError) throw firmInsertError
      firmId = insertedFirm.id
    }

    // 6. Insert the profile blob, conflict-safe on the unique firm_id.
    const { error: profileError } = await supabaseAdmin
      .from('firm_profiles')
      .upsert(
        { firm_id: firmId, attributes: signup.profile },
        { onConflict: 'firm_id', ignoreDuplicates: true }
      )
    if (profileError) throw profileError

    // 7. Create the auth identity, tolerating already-exists (retry safety).
    const authUserId = await ensureAuthUser(signup.email)

    // 8. Insert the users row (admin), conflict-safe on the primary key.
    const { error: userError } = await supabaseAdmin
      .from('users')
      .upsert(
        { id: authUserId, firm_id: firmId, email: signup.email, role: 'admin' },
        { onConflict: 'id', ignoreDuplicates: true }
      )
    if (userError) throw userError

    // 9. CONSUME THE SIGNUP LAST — only now is it safe to retire it.
    const { error: consumeError } = await supabaseAdmin
      .from('pending_signups')
      .update({ status: 'consumed' })
      .eq('id', pendingSignupId)
      .eq('status', 'pending')
    if (consumeError) throw consumeError

    // Welcome email — NON-FATAL. The firm is provisioned and the signup consumed;
    // a throw here would make Stripe retry a completed provisioning. Placed AFTER
    // the consume (step 9), so any retry hits the 'already consumed' branch (step 3)
    // and returns before reaching here — the email is sent at most once.
    try {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: signup.email,
        options: { redirectTo: `${origin}/auth/callback` },
      })
      if (linkError) throw linkError
      // Self-construct the callback link from hashed_token (NOT action_link, which
      // routes through Supabase's verify endpoint and never delivers token_hash here).
      const hashedToken = linkData.properties?.hashed_token
      if (!hashedToken) throw new Error('No hashed_token in generateLink response')
      const link = `${origin}/auth/callback?token_hash=${hashedToken}&type=magiclink`

      const resend = new Resend(process.env.RESEND_API_KEY!)
      const { error: sendError } = await resend.emails.send({
        from: process.env.RESEND_FROM!,
        to: signup.email,
        subject: 'Welcome to Sentry — your sign-in link',
        html: `
<div style="font-family: inherit; color: #0f1115; line-height: 1.5;">
  <p>Welcome, ${signup.firm_name}.</p>
  <p>Sentry monitors Australian regulators and Parliament for items material to your firm.</p>
  <p><a href="${link}" style="color: #14365e;">Sign in to Sentry</a></p>
  <p>This link expires shortly. If it has expired, request a new one at ${origin}/login.</p>
</div>`.trim(),
      })
      if (sendError) throw sendError
      console.log('welcome email sent; session:', session.id, 'email:', signup.email)
    } catch (emailErr) {
      // Non-fatal: provisioning already succeeded. Log and swallow — never rethrow.
      console.error('welcome email failed (non-fatal); session:', session.id, emailErr)
    }

    // 10.
    return new Response('ok', { status: 200 })
  } catch (err) {
    // Retry is SAFE here (build-last): signup is still 'pending', every insert is
    // conflict-safe, auth is already-exists-tolerant. We WANT Stripe to retry.
    console.error('checkout.session.completed handler failed; session:', session.id, err)
    return new Response('handler error', { status: 500 })
  }
}

// Create the Supabase auth user, or find the existing one on retry. No password.
async function ensureAuthUser(email: string): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (!error && data.user) {
    return data.user.id
  }

  // createUser failed — if it's because the user already exists (a retry), find
  // them and use that id. Anything else is a real error and rethrows.
  const alreadyExists =
    !!error &&
    ((error as { code?: string }).code === 'email_exists' ||
      error.status === 422 ||
      /already|exists|registered/i.test(error.message))
  if (!alreadyExists) {
    throw error
  }

  const existingId = await findAuthUserIdByEmail(email)
  if (!existingId) throw error
  return existingId
}

// Page through the auth user list and match on email (case-insensitive).
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const target = email.toLowerCase()
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const match = data.users.find((u) => (u.email ?? '').toLowerCase() === target)
    if (match) return match.id
    if (data.users.length < 1000) return null // last page, not found
  }
}

// ---------------------------------------------------------------------------
// customer.subscription.updated / .deleted — only ever UPDATES an existing
// firm. The completion handler is the sole creator; if the firm isn't here yet
// (a lifecycle event racing ahead of checkout completion), we ack and wait.
// ---------------------------------------------------------------------------
async function handleSubscriptionLifecycle(
  eventType: 'customer.subscription.updated' | 'customer.subscription.deleted',
  sub: Stripe.Subscription
): Promise<Response> {
  const { data: firm, error: firmError } = await supabaseAdmin
    .from('firms')
    .select('id')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle()
  if (firmError) {
    console.error('subscription lifecycle firm lookup failed; sub:', sub.id, firmError)
    return new Response('lookup error', { status: 500 })
  }
  if (!firm) {
    // No firm yet — the completion handler hasn't created it. Do nothing.
    return new Response('no firm', { status: 200 })
  }

  const update: Record<string, unknown> = {
    subscription_status:
      eventType === 'customer.subscription.deleted' ? 'canceled' : sub.status,
  }

  // trial_ends_at is a durable fact: write it only when Stripe sends a trial_end.
  // Once the trial converts, subscription.updated arrives with trial_end = null —
  // omit the key so the stored value is left untouched (do NOT null it).
  // trial_end is UNIX SECONDS — *1000 to milliseconds is mandatory.
  if (sub.trial_end) {
    update.trial_ends_at = new Date(sub.trial_end * 1000).toISOString()
  }

  // Update tier only if the price is derivable; otherwise leave it unchanged.
  const priceId = sub.items?.data?.[0]?.price?.id
  if (priceId && PRICE_ID_TO_TIER[priceId]) {
    update.tier = PRICE_ID_TO_TIER[priceId]
  }

  const { error: updateError } = await supabaseAdmin
    .from('firms')
    .update(update)
    .eq('id', firm.id)
  if (updateError) {
    console.error('subscription lifecycle update failed; sub:', sub.id, updateError)
    return new Response('update error', { status: 500 })
  }

  return new Response('ok', { status: 200 })
}
