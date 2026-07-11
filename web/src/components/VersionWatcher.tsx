"use client";

import { useEffect, useRef, useState } from "react";

// Keeps everyone on the latest deploy without yanking the page mid-use.
// Installed PWAs happily resume old code from memory and never re-fetch, so we
// poll which build is live and:
//   • when you RETURN to the app after switching away → silently reload to the
//     latest (you weren't mid-thought, so it's invisible and keeps you current);
//   • when a deploy lands WHILE you're actively using it → show a small,
//     dismissible "refresh" pill instead of interrupting.
// This is the balance: nobody gets stuck on stale code (the reason People search
// looked missing), but a reply or half-typed thought is never wiped out.
export function VersionWatcher() {
  const dismissed = useRef(false);
  const wasHidden = useRef(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!mine || mine === "dev") return;

    async function latestDiffers(): Promise<boolean> {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return false;
        const { v } = (await res.json()) as { v?: string };
        return !!v && v !== mine;
      } catch {
        return false;
      }
    }

    // Detected while actively using → offer the pill, never yank.
    async function checkActive() {
      if (dismissed.current || updateReady || document.visibilityState !== "visible") return;
      if (await latestDiffers()) setUpdateReady(true);
    }

    async function onVisibility() {
      if (document.visibilityState === "hidden") {
        wasHidden.current = true;
        return;
      }
      // Just came back to the app → safe to jump straight to the latest.
      if (wasHidden.current) {
        wasHidden.current = false;
        if (await latestDiffers()) {
          window.location.reload();
          return;
        }
      }
      void checkActive();
    }

    document.addEventListener("visibilitychange", onVisibility);
    const id = window.setInterval(checkActive, 60_000);
    void checkActive();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
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
