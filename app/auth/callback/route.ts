import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Completes the magic-link exchange. The email link points here with token_hash
// + type; verifyOtp validates it and persists the session to cookies, then we
// land on /home.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (token_hash && type) {
    // createClient wires @supabase/ssr createServerClient to awaited cookies(),
    // so verifyOtp's Set-Cookie lands on the response.
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: type as "magiclink" | "email",
      token_hash,
    });
    if (!error) {
      return NextResponse.redirect(new URL("/home", req.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", req.url));
}
