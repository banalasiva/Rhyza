"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client";

// Follow / unfollow a person. Optimistic; rolls back on failure.
export function FollowUserButton({
  userId,
  initialFollowing,
}: {
  userId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      await apiPost(`/api/users/${userId}/follow`, { following: next });
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
        following
          ? "border-[rgba(76,175,80,0.4)] text-accent"
          : "border-transparent bg-[#4CAF50] text-[#070D07] hover:bg-[#5cbb60]"
      }`}
    >
      {following ? "✓ Following" : "+ Follow"}
    </button>
  );
}
