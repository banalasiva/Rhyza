"use client";

import { useEffect, useRef } from "react";

// Keeps everyone on the latest deploy. Installed PWAs happily resume old code
// from memory and never re-fetch, so on focus (and once a minute) we ask the
// server which build is live; if it's newer than the one we loaded, we reload
// once to pick it up. No-op in dev (build id "dev").
export function VersionWatcher() {
  const reloaded = useRef(false);

  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!mine || mine === "dev") return;

    async function check() {
      if (reloaded.current || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { v } = (await res.json()) as { v?: string };
        if (v && v !== mine) {
          reloaded.current = true;
          window.location.reload();
        }
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
  }, []);

  return null;
}
