/* Static cancellation landing for the Stripe checkout cancel_url. Server
   component — no client JS needed. */

import Link from "next/link";

function Wordmark() {
  return (
    <span
      style={{
        fontFamily: "var(--display-font)",
        fontWeight: 500,
        fontSize: 18,
        letterSpacing: "-0.02em",
        color: "var(--ink)",
      }}
    >
      Sentry
    </span>
  );
}

export default function SignupCancelledPage() {
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
          borderRadius: 8,
          padding: 40,
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <Wordmark />
        </div>

        <h1 className="t-title" style={{ margin: "0 0 10px" }}>
          Checkout cancelled
        </h1>
        <p className="t-body" style={{ margin: 0, color: "var(--ink-mute)" }}>
          No charge was made. You can return to the site and start again whenever
          you&apos;re ready.
        </p>

        <div style={{ marginTop: 24 }}>
          <Link href="/" className="t-body">
            Return to Sentry
          </Link>
        </div>
      </div>
    </main>
  );
}
