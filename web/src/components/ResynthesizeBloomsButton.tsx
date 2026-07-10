"use client";

import { useState } from "react";
import { apiGet } from "@/lib/client";

// Owner-only: rebuild every AI-synthesized bloom with the current format
// (essence → key points → conclusion). Human-edited blooms are left alone.
export function ResynthesizeBloomsButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    if (!confirm("Re-synthesize all AI-generated blooms into the new format? Edited blooms are left untouched.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiGet<{ updated: number; skipped: number; failed: number; total: number }>(
        "/api/admin/resynthesize-blooms?fire=1",
      );
      const parts = [`Updated ${r.updated}`];
      if (r.skipped) parts.push(`kept ${r.skipped} edited`);
      if (r.failed) parts.push(`${r.failed} failed`);
      setMsg(`${parts.join(" · ")} 🌸`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-4 p-4">
      <p className="mb-1 text-sm text-ink">🌸 Re-synthesize blooms</p>
      <p className="mb-3 text-xs text-ink-soft">
        Rebuild every AI-generated bloom in the new scannable format (essence · key points ·
        conclusion). Blooms someone has edited by hand are left as they are.
      </p>
      <button onClick={run} disabled={busy} className="btn-ghost text-xs disabled:opacity-50">
        {busy ? "Re-synthesizing…" : "Re-synthesize all"}
      </button>
      {msg && <p className="mt-2 text-xs text-ink-mid">{msg}</p>}
    </div>
  );
}
