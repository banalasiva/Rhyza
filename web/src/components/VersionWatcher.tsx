"use client";

import { useEffect, useRef, useState } from "react";

// Keeps everyone on the latest deploy WITHOUT yanking the page out from under
// them. Installed PWAs happily resume old code from memory and never re-fetch,
// so we quietly poll which build is live — but when a newer one appears we show
// a small, dismissible "refresh" pill instead of force-reloading. The person
// chooses when to update, so a reply or a half-typed thought is never lost.
export function VersionWatcher() {
  const dismissed = useRef(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!mine || mine === "dev") return;

    async function check() {
      if (dismissed.current || updateReady || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { v } = (await res.json()) as { v?: string };
        if (v && v !== mine) setUpdateReady(true);
      } catch {
        /* offline / transient — try again later */
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(check, 60_000);
    check();
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [updateReady]);

  if (!updateReady) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[90] flex justify-center px-3">
      <div className="flex items-center gap-3 rounded-full border border-[rgba(76,175,80,0.35)] bg-[#0B120B] px-4 py-2 shadow-2xl">
        <span className="text-xs text-ink">A new version is ready</span>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-bg"
        >
          Refresh
        </button>
        <button
          onClick={() => {
            dismissed.current = true;
            setUpdateReady(false);
          }}
          aria-label="Later"
          className="text-ink-soft transition hover:text-ink"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
