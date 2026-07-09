"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client";

// Follow / unfollow a public seed. Optimistic; rolls back on failure. Safe to
// place inside a card Link — it stops the click from navigating.
export function FollowButton({
  seedId,
  initialFollowing,
  size = "sm",
}: {
  seedId: string;
  initialFollowing: boolean;
  size?: "sm" | "md";
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      await apiPost(`/api/seeds/${seedId}/follow`, { following: next });
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  const pad = size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      title={following ? "You're tending this seed — tap to stop" : "Tend this seed to watch it grow"}
      className={`shrink-0 rounded-full border font-medium transition disabled:opacity-60 ${pad} ${
        following
          ? "border-[rgba(76,175,80,0.4)] text-accent"
          : "border-transparent bg-[#4CAF50] text-[#070D07] hover:bg-[#5cbb60]"
      }`}
    >
      {following ? "🌿 Tending" : "🌱 Tend"}
    </button>
  );
}
