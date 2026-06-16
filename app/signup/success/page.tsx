"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

/* Provisioning races the browser redirect, so the firm may not exist on load.
   This page polls /api/signup/status until the webhook has provisioned it. */

type View = "pending" | "ready" | "error" | "timeout" | "missing";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15; // ~30s, then stop and tell them to wait / contact support

const COPY: Record<View, { heading: string; body: string }> = {
  pending: {
    heading: "Setting up your account",
    body: "This usually takes a few seconds.",
  },
  ready: {
    heading: "Your account is ready",
    body: "Your firm's workspace has been provisioned. Sign-in details will follow shortly.",
  },
  error: {
    heading: "Something went wrong",
    body: "We couldn't confirm your account setup. Please contact support and we'll resolve it.",
  },
  timeout: {
    heading: "This is taking longer than expected",
    body: "Your account may still be provisioning. If it isn't ready shortly, please contact support.",
  },
  missing: {
    heading: "Something went wrong",
    body: "We couldn't find your checkout session. If you completed payment, please contact support.",
  },
};

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

function Shell({ children }: { children: ReactNode }) {
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
        {children}
      </div>
    </main>
  );
}

function StateCopy({ view }: { view: View }) {
  const { heading, body } = COPY[view];
  return (
    <>
      <h1 className="t-title" style={{ margin: "0 0 10px" }}>
        {heading}
      </h1>
      <p className="t-body" style={{ margin: 0, color: "var(--ink-mute)" }}>
        {body}
      </p>
    </>
  );
}

function SuccessInner() {
  const sessionId = useSearchParams().get("session_id");
  const [view, setView] = useState<View>("pending");

  useEffect(() => {
    if (!sessionId) return; // no session — render derives the 'missing' state

    let cancelled = false;
    let polls = 0;

    const poll = async () => {
      polls += 1;
      try {
        const res = await fetch(
          `/api/signup/status?session_id=${encodeURIComponent(sessionId)}`,
        );
        const data = (await res.json()) as { status?: string };
        if (cancelled) return;
        if (data.status === "ready") {
          setView("ready");
          clearInterval(timer);
          return;
        }
        if (data.status === "error") {
          setView("error");
          clearInterval(timer);
          return;
        }
        // 'pending' — keep the in-progress view and keep polling, up to the cap.
        if (polls >= MAX_POLLS) {
          setView("timeout");
          clearInterval(timer);
        }
      } catch {
        // Network hiccup — treat as still pending unless we've exhausted the cap.
        if (cancelled) return;
        if (polls >= MAX_POLLS) {
          setView("timeout");
          clearInterval(timer);
        }
      }
    };

    const timer = setInterval(poll, POLL_INTERVAL_MS);
    poll(); // immediate first check

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionId]);

  // 'missing' is derived from the URL, not stored — avoids setState in the effect.
  const effectiveView: View = sessionId ? view : "missing";

  return (
    <Shell>
      <StateCopy view={effectiveView} />
    </Shell>
  );
}

export default function SignupSuccessPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense
      fallback={
        <Shell>
          <StateCopy view="pending" />
        </Shell>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
