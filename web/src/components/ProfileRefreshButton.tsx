"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

// Owner-only button to re-run the AI summary that fills "How you show up" and
// "Mostly involved in" from your recent activity. Same endpoint the page
// auto-fires on first visit, but on demand — for when you've been active since
// and want the mirror refreshed. It's a Claude call (a few seconds), so we show
// a clear working state and refresh the page when it lands.
export function ProfileRefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    setDone(false);
    track("profile_refresh");
    try {
      const r = await fetch("/api/me/profile/enrich", { method: "POST" });
      if (r.ok) {
        setDone(true);
        router.refresh();
        setTimeout(() => setDone(false), 2500);
      }
    } catch {
      /* ignore — leave the existing content in place */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={run}
      disabled={busy}
      className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-60"
      title="Regenerate 'How you show up' and 'Mostly involved in' from your recent activity"
    >
      {busy ? "✨ Updating…" : done ? "✓ Updated" : "✨ Refresh from my activity"}
    </button>
  );
}
