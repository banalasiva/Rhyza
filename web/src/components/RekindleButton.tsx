"use client";

import { useState } from "react";
import { apiGet } from "@/lib/client";

// Owner-only: run the "Claude re-kindles quiet threads" pass right now, instead
// of waiting for the evening cron. Reports how many quiet threads it scanned and
// how many it re-opened with a fresh message.
export function RekindleButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiGet<{ scanned: number; sparked: number }>("/api/admin/rekindle?fire=1");
      setMsg(
        r.sparked > 0
          ? `Claude re-opened ${r.sparked} ${r.sparked === 1 ? "thread" : "threads"} out of ${r.scanned} quiet one${r.scanned === 1 ? "" : "s"} 🌿`
          : `Scanned ${r.scanned} quiet thread${r.scanned === 1 ? "" : "s"} — none worth reviving right now.`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-4 p-4">
      <p className="mb-1 text-sm text-ink">🌿 Re-kindle quiet threads</p>
      <p className="mb-3 text-xs text-ink-soft">
        Claude reads threads that have gone quiet and, when there&apos;s a real open question worth
        returning to, posts a short, warm re-opener right in the thread to get it going again — only
        when there&apos;s a real reason. Runs nightly; tap to run it now.
      </p>
      <button onClick={run} disabled={busy} className="btn-ghost text-xs disabled:opacity-50">
        {busy ? "Scanning…" : "Scan & re-open now"}
      </button>
      {msg && <p className="mt-2 text-xs text-ink-mid">{msg}</p>}
    </div>
  );
}
