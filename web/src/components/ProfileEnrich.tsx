"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// When the owner's AI topics/reflection haven't been generated yet, this fires a
// one-off background request to generate them (a Claude call that we deliberately
// keep OFF the page render) and refreshes the route once it lands — so the page
// paints instantly and the AI sections fill in a moment later. Renders nothing.
export function ProfileEnrich({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const fired = useRef(false);
  useEffect(() => {
    if (!enabled || fired.current) return;
    fired.current = true;
    fetch("/api/me/profile/enrich", { method: "POST" })
      .then((r) => {
        if (r.ok) router.refresh();
      })
      .catch(() => {});
  }, [enabled, router]);
  return null;
}
