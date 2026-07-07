"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client";

// Owner-only: tag existing untagged seeds with topics, one batch per click.
export function BackfillTopicsButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    try {
      const r = await apiPost<{ tagged: number; remaining: number }>("/api/admin/backfill-topics", {});
      setMsg(
        r.remaining > 0
          ? `Filled ${r.tagged}. ${r.remaining} still to go — click again.`
          : `Filled ${r.tagged}. All caught up 🎉`,
      );
    } catch {
      setMsg("Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-4 p-4">
      <p className="mb-1 text-sm text-ink">🏷️ Backfill profile topics</p>
      <p className="mb-3 text-xs text-ink-soft">
        Have Claude name the areas each person is involved in, so older profiles fill in. Runs a
        batch each click.
      </p>
      <button onClick={run} disabled={busy} className="btn-ghost text-xs disabled:opacity-50">
        {busy ? "Filling…" : "Fill a batch"}
      </button>
      {msg && <p className="mt-2 text-xs text-ink-mid">{msg}</p>}
    </div>
  );
}
