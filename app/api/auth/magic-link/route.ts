import { Resend } from "resend";
import { adminClient as supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Plain, witness-register email. No firm name here (returning user, not signup).
function magicLinkEmail(link: string, origin: string): string {
  return `
<div style="font-family: inherit; color: #0f1115; line-height: 1.5;">
  <p>Sentry monitors Australian regulators and Parliament for items material to your firm.</p>
  <p><a href="${link}" style="color: #14365e;">Sign in to Sentry</a></p>
  <p>This link expires shortly. If it has expired, request a new one at ${origin}/login.</p>
</div>`.trim();
}

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;

  let email: string | undefined;
  try {
    const body = (await req.json()) as { email?: unknown };
    if (typeof body.email === "string") email = body.email.trim();
  } catch {
    email = undefined;
  }

  if (!email) {
    return Response.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    // generateLink throws for a non-existent user — that lands in the catch below,
    // which still returns 200 so we never reveal whether the account exists.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/auth/callback` },
    });
    if (error) throw error;

    // Self-construct the callback link from hashed_token (NOT action_link, which
    // routes through Supabase's verify endpoint and never delivers token_hash here).
    const hashedToken = data.properties?.hashed_token;
    if (!hashedToken) throw new Error("No hashed_token in generateLink response");
    const link = `${origin}/auth/callback?token_hash=${hashedToken}&type=magiclink`;

    const resend = new Resend(process.env.RESEND_API_KEY!);
    const { error: sendError } = await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: email,
      subject: "Your Sentry sign-in link",
      html: magicLinkEmail(link, origin),
    });
    if (sendError) throw sendError;
  } catch (err) {
    // Never reveal account existence and never 500 to the client. Log server-side.
    console.error("magic-link request failed (returning ok regardless):", err);
  }

  return Response.json({ ok: true }, { status: 200 });
}
