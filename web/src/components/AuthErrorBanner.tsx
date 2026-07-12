"use client";

import { useEffect } from "react";

// Shown on /login when Auth.js bounced back with ?error=CODE. Two jobs: tell the
// person in plain language what went wrong, and log the failure once so the
// owner sees it on the admin panel (sign-in failures are a sev2). The log call
// is guarded by sessionStorage so a refresh doesn't double-count.
export function AuthErrorBanner({ code, message }: { code: string; message: string }) {
  useEffect(() => {
    const key = `authlog:${code}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode — fall through and still try to log once */
    }
    fetch("/api/auth/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      keepalive: true,
    }).catch(() => {});
  }, [code]);

  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-[rgba(229,115,115,0.4)] bg-[rgba(229,115,115,0.08)] px-3 py-2.5 text-left"
    >
      <p className="text-sm font-medium text-[#e57373]">Couldn’t sign you in</p>
      <p className="mt-0.5 text-xs text-ink-mid">{message}</p>
    </div>
  );
}
