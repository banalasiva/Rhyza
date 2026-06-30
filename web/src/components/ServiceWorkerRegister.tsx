"use client";

import { useEffect } from "react";

// Registers the service worker on every app load (not just when someone enables
// push), so its static-asset cache speeds up loads for all users. Idempotent:
// the browser dedupes registration of the same script URL/scope, so this
// coexists with the push-enable flow's own register() call.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // Defer past first paint so registration never competes with rendering.
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
