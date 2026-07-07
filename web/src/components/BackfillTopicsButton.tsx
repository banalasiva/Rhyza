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
          ? `Tagged ${r.tagged}. ${r.remaining} still to go — click again.`
          : `Tagged ${r.tagged}. All caught up 🎉`,
      );
    } catch {
      setMsg("Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-4 p-4">
      <p className="mb-1 text-sm text-ink">🏷️ Backfill seed topics</p>
      <p className="mb-3 text-xs text-ink-soft">
        Tag older seeds so people&apos;s profile topics fill in. Runs a batch each click.
      </p>
      <button onClick={run} disabled={busy} className="btn-ghost text-xs disabled:opacity-50">
        {busy ? "Tagging…" : "Tag a batch"}
      </button>
      {msg && <p className="mt-2 text-xs text-ink-mid">{msg}</p>}
    </div>
  );
}
