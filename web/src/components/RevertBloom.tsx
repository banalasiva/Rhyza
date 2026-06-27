"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Revert (roll back) a bloom — deletes it and re-opens the seed so the
// conversation can continue. Shown only to the seed's author / a steward.
export function RevertBloom({ seedId }: { seedId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revert() {
    if (
      !confirm(
        "Revert this bloom? It will be removed and the seed re-opened so people can keep contributing. This can't be undone.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/seeds/${seedId}/bloom`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to revert");
      router.push(`/seeds/${seedId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revert");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-[rgba(255,255,255,0.06)] pt-4 text-center">
      <button
        onClick={revert}
        disabled={busy}
        className="btn-ghost px-4 py-1.5 text-xs text-ink-soft hover:text-[#e57373]"
      >
        {busy ? "Reverting…" : "↩ Revert this bloom"}
      </button>
      <p className="mt-1.5 text-[11px] text-ink-soft">
        Re-opens the seed for more contributions.
      </p>
      {error && <p className="mt-2 text-sm text-[#e57373]">{error}</p>}
    </div>
  );
}
