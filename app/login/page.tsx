"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "idle" | "sending" | "sent" | "error";

function LoginInner() {
  const invalid = useSearchParams().get("error") === "invalid_link";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const sendLink = async () => {
    if (!email.trim()) {
      setError("Email is required.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

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
          maxWidth: 380,
          background: "var(--ground-raised)",
          border: "1px solid var(--hairline)",
          padding: 24,
        }}
      >
        <h1 className="t-title" style={{ margin: "0 0 12px" }}>
          Sign in to Sentry
        </h1>

        {invalid && (
          <p className="t-body" style={{ margin: "0 0 12px", color: "var(--signal)", fontSize: 14 }}>
            That link was invalid or expired. Request a new one below.
          </p>
        )}

        {status === "sent" ? (
          <p className="t-body" style={{ margin: 0, color: "var(--ink-mute)" }}>
            Check your email for a sign-in link.
          </p>
        ) : (
          <>
            <p className="t-body" style={{ margin: "0 0 12px", color: "var(--ink-mute)", fontSize: 14 }}>
              Enter your work email to receive a sign-in link.
            </p>
            <input
              type="email"
              placeholder="Work email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid var(--hairline)",
                padding: 8,
                marginBottom: 8,
                background: "var(--ground)",
                color: "var(--ink)",
                fontFamily: "inherit",
                fontSize: 14,
              }}
            />
            {error && (
              <p className="t-body" style={{ margin: "0 0 8px", color: "var(--signal)", fontSize: 14 }}>
                {error}
              </p>
            )}
            <button
              onClick={sendLink}
              disabled={status === "sending"}
              className="btn btn-primary"
              style={{ width: "100%", fontSize: 13 }}
            >
              {status === "sending" ? "Sending..." : "Send sign-in link"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
