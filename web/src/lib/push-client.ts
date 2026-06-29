// Browser-side Web Push helpers, shared by the notification settings UI. These
// touch navigator/window, so only call them from client event handlers/effects.

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushState = "on" | "off" | "denied" | "unsupported";

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function abToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// A subscription is permanently bound to the VAPID key it was created with. If
// the server key has since changed, that subscription is rejected (403) on every
// send — so we must detect the mismatch and replace it.
function subscriptionMatchesKey(sub: PushSubscription, vapidPublic: string): boolean {
  try {
    const key = sub.options?.applicationServerKey;
    if (!key) return false;
    return abToBase64Url(key as ArrayBuffer) === vapidPublic.replace(/=+$/, "");
  } catch {
    return false;
  }
}

// Ensure a subscription exists that matches the CURRENT server key, and save it.
async function subscribeFresh(reg: ServiceWorkerRegistration): Promise<boolean> {
  if (!VAPID_PUBLIC) return false;
  let existing = await reg.pushManager.getSubscription();
  if (existing && !subscriptionMatchesKey(existing, VAPID_PUBLIC)) {
    try {
      await existing.unsubscribe();
    } catch {
      /* ignore */
    }
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: existing.endpoint }),
    }).catch(() => {});
    existing = null;
  }
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
    }));
  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  return res.ok;
}

// The browser permission, mapped to our simple states.
export function pushPermission(): PushState {
  if (!supported()) return "unsupported";
  const p = Notification.permission;
  if (p === "denied") return "denied";
  if (p === "granted") return "on";
  return "off";
}

// Does THIS device currently have an active push subscription? (Permission can
// be granted while no subscription exists — e.g. right after unsubscribing.)
export async function deviceSubscribed(): Promise<boolean> {
  if (!supported() || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

// Turn push ON for this device: register SW, request permission, subscribe.
export async function enablePush(): Promise<PushState> {
  if (!supported()) return "unsupported";
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "off";
  await subscribeFresh(reg);
  return "on";
}

// Turn push OFF for this device: drop the browser subscription + server row.
export async function disablePush(): Promise<void> {
  if (!supported()) return;
  const reg =
    (await navigator.serviceWorker.getRegistration()) ??
    (await navigator.serviceWorker.register("/sw.js"));
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    try {
      await sub.unsubscribe();
    } catch {
      /* ignore */
    }
  }
}

// Show a notification on THIS device immediately via the service worker — no
// push round-trip. The reliable self-test: if permission is granted and the OS
// allows it, you see it instantly. Returns whether it was shown.
export async function showLocalNotification(title: string, body: string): Promise<boolean> {
  if (!supported() || Notification.permission !== "granted") return false;
  try {
    await navigator.serviceWorker.register("/sw.js");
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "thinkthru-test",
    });
    return true;
  } catch {
    return false;
  }
}

// If permission is already granted, make sure a fresh, key-matched subscription
// is saved (self-heals subscriptions bound to an old key). Safe to call on load.
export async function healPush(): Promise<void> {
  if (!supported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  await subscribeFresh(reg).catch(() => {});
}
