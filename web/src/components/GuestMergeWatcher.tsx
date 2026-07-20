"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Mounted (by NavBar) only when a guest→real merge is actually pending — i.e. a
// "tt-was-guest" marker exists but the current account is real. It runs the
// merge once, then refreshes so the new identity shows immediately. No-op UI.
export function GuestMergeWatcher() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/claim-guest", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.merged) router.refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);
  return null;
}
