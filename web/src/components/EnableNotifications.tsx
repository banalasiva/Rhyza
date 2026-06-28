"use client";

import { useEffect, useState } from "react";

// A small, friendly control to turn on phone/desktop push notifications. It
// registers the service worker, asks the browser for permission, subscribes to
// Web Push, and saves the subscription. Progressive enhancement: if the browser
// can't do push (or no VAPID key is configured) it quietly renders nothing.

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = "unsupported" | "default" | "granted" | "denied" | "working";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function EnableNotifications() {
  const [state, setState] = useState<State>("default");

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported || !VAPID_PUBLIC) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as State);
    // Keep the SW registered so incoming pushes are handled even when no tab
    // explicitly registered it this session.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  async function enable() {
    if (!VAPID_PUBLIC) return;
    setState("working");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission as State);
        return;
      }
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
        }));
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setState("granted");
    } catch (err) {
      console.error("push enable failed", err);
      setState("default");
    }
  }

  if (state === "unsupported") return null;

  if (state === "granted") {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <span aria-hidden>🔔</span> Push notifications are on for this device.
      </div>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-sm text-ink-soft">
        Notifications are blocked in your browser. Enable them in your browser’s site
        settings to get phone alerts.
      </p>
    );
  }

  return (
    <button
      onClick={enable}
      disabled={state === "working"}
      className="rounded-full bg-[#4CAF50] px-4 py-2 text-sm font-semibold text-[#070D07] transition hover:bg-[#5cbb60] disabled:opacity-60"
    >
      {state === "working" ? "Turning on…" : "🔔 Turn on notifications"}
    </button>
  );
}
