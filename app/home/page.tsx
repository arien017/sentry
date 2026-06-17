import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient as supabaseAdmin } from "@/lib/supabase/admin";

// Placeholder authenticated home — proves sign-in works. Replaced by the real
// agentic home later.
export default async function HomePage() {
  // SSR session client (@supabase/ssr createServerClient + awaited cookies()).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Firm lookup by the authenticated user's id (service-role, server-side).
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("firm_id")
    .eq("id", user.id)
    .maybeSingle();

  let firmName: string | null = null;
  if (userRow?.firm_id) {
    const { data: firm } = await supabaseAdmin
      .from("firms")
      .select("name")
      .eq("id", userRow.firm_id)
      .maybeSingle();
    firmName = firm?.name ?? null;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--ground)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--ground-raised)",
          border: "1px solid var(--hairline)",
          padding: 40,
        }}
      >
        <h1 className="t-title" style={{ margin: "0 0 12px" }}>
          Sentry
        </h1>
        <p className="t-body" style={{ margin: "0 0 4px", color: "var(--ink)" }}>
          Signed in as {user.email}
        </p>
        <p className="t-body" style={{ margin: 0, color: "var(--ink-mute)" }}>
          Firm: {firmName ?? "—"}
        </p>
      </div>
    </main>
  );
}
