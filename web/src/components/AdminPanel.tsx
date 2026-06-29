"use client";

import { useState } from "react";

// One-tap "apply pending database migrations" for the owner, from any device
// (phone included). Calls the idempotent /api/admin/migrate endpoint.
export function AdminPanel() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/migrate", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOk(data.ok !== false);
        const ran = Array.isArray(data.ran) ? data.ran.length : 0;
        const failed = Array.isArray(data.failed) ? data.failed : [];
        setResult(
          `Applied ${ran} statement${ran === 1 ? "" : "s"}.` +
            (failed.length ? ` ${failed.length} failed: ${failed.map((f: { label: string }) => f.label).join(", ")}` : " Everything's up to date."),
        );
      } else {
        setOk(false);
        setResult(data?.error?.message ?? "Couldn't run migrations.");
      }
    } catch {
      setOk(false);
      setResult("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-ink">Database</p>
      <p className="mt-1 text-xs text-ink-soft">
        Apply any pending schema updates (safe to tap anytime — it only adds
        what&apos;s missing).
      </p>
      <button
        onClick={run}
        disabled={busy}
        className="btn-primary mt-3 text-sm disabled:opacity-50"
      >
        {busy ? "Applying…" : "Apply database updates"}
      </button>
      {result && (
        <p className={`mt-2 text-xs ${ok ? "text-accent" : "text-[#e57373]"}`}>{result}</p>
      )}
    </div>
  );
}
