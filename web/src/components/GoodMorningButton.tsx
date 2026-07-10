"use client";

import { useState } from "react";
import { apiGet } from "@/lib/client";

// Owner-only: fire the daily "Good morning 🌱" push to everyone right now — a
// one-tap safety net for when the scheduled cron misses (or before it's proven).
// Hits the same endpoint as the URL trick, so no new server code.
export function GoodMorningButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiGet<{ fired: boolean; sent: number; recipients: number }>(
        "/api/admin/good-morning?fire=1",
      );
      setMsg(`Sent to ${r.sent} of ${r.recipients} device${r.recipients === 1 ? "" : "s"} 🌱`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-4 p-4">
      <p className="mb-1 text-sm text-ink">🌅 Send good-morning now</p>
      <p className="mb-3 text-xs text-ink-soft">
        Pushes today&apos;s quote + question to everyone who has notifications on. Use it if the 9:30
        cron missed. Only reaches devices that are currently subscribed.
      </p>
      <button onClick={run} disabled={busy} className="btn-primary text-xs disabled:opacity-50">
        {busy ? "Sending…" : "Send to everyone"}
      </button>
      {msg && <p className="mt-2 text-xs text-ink-mid">{msg}</p>}
    </div>
  );
}
