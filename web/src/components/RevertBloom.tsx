"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Actions on a published bloom, for the seed's creator / a steward:
//  • Reopen to evolve (primary) — keep this bloom as history and reactivate the
//    seed so the community can grow the next version. This is how people change
//    their mind: nothing is erased, knowledge gains a v2.
//  • Delete this bloom (subtle) — for a genuine mistake; removes it entirely.
export function RevertBloom({ seedId, version }: { seedId: string; version: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "reopen" | "delete">(null);
  const [error, setError] = useState<string | null>(null);

  async function reopen() {
    if (
      !confirm(
        `Reopen this seed to evolve it? Version ${version} stays saved as history, and the seed becomes active again so people can refine it into v${version + 1}.`,
      )
    )
      return;
    setBusy("reopen");
    setError(null);
    try {
      const res = await fetch(`/api/seeds/${seedId}/bloom`, { method: "PATCH" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to reopen");
      router.push(`/seeds/${seedId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen");
      setBusy(null);
    }
  }

  async function remove() {
    if (
      !confirm(
        "Delete this bloom entirely? Use this only for a mistaken bloom — the summary and this version are removed and the seed reopens.",
      )
    )
      return;
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/seeds/${seedId}/bloom`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to delete");
      router.push(`/seeds/${seedId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 border-t border-[rgba(255,255,255,0.06)] pt-4 text-center">
      <button onClick={reopen} disabled={busy !== null} className="btn-ghost px-4 py-2 text-sm">
        {busy === "reopen" ? "Reopening…" : "🔄 Reopen to evolve"}
      </button>
      <p className="mt-1.5 text-[11px] text-ink-soft">
        Changed your mind? Keep this version and grow the next one.
      </p>
      {error && <p className="mt-2 text-sm text-[#e57373]">{error}</p>}
      <button
        onClick={remove}
        disabled={busy !== null}
        className="mt-3 text-[11px] text-ink-soft underline hover:text-[#e57373]"
      >
        {busy === "delete" ? "Deleting…" : "Or delete this bloom (mistake)"}
      </button>
    </div>
  );
}
