"use client";

import { useEffect } from "react";

// Registers the service worker on every app load (not just when someone enables
// push), so its static-asset cache speeds up loads for all users. Idempotent:
// the browser dedupes registration of the same script URL/scope, so this
// coexists with the push-enable flow's own register() call.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // When a new service worker REPLACES an existing one (a fresh deploy), reload
    // once so the page runs the new assets instead of a stale cached bundle.
    //
    // Critically, DON'T reload on the FIRST install: on a brand-new device there
    // is no controller yet, and the SW's clients.claim() fires controllerchange
    // as it first takes control. Reloading then can interrupt the app mid-startup
    // (the login redirect / hydration) and strand it on the splash "thumbnail"
    // until a reinstall — exactly the stuck-screen a first-time visitor hit. So
    // only reload when a controller already existed (a genuine update).
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded || !hadController) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    // Defer past first paint so registration never competes with rendering.
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }, 0);
    return () => {
      window.clearTimeout(id);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);
  return null;
}
