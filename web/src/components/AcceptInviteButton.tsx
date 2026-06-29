"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/client";

export function AcceptInviteButton({ token, seed = false }: { token: string; seed?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ gardenId: string | null; seedId: string | null }>(
        `/api/invites/${token}/accept`,
      );
      // Seed invite → land on the seed; garden invite → the garden; else home.
      router.push(
        res.seedId
          ? `/seeds/${res.seedId}`
          : res.gardenId
            ? `/gardens/${res.gardenId}`
            : "/",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't accept invite");
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={accept} className="btn-primary w-full" disabled={busy}>
        {busy ? "Joining…" : seed ? "Join the conversation 🌿" : "Accept & join"}
      </button>
      {error && <p className="mt-2 text-sm text-[#e57373]">{error}</p>}
    </div>
  );
}
