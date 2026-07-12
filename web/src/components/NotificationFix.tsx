"use client";

import { useEffect, useState } from "react";
import {
  pushPermission,
  deviceSubscribed,
  enablePush,
  healPush,
  showLocalNotification,
} from "@/lib/push-client";

// The always-there "notifications not arriving? fix it" control. Web-push
// subscriptions go stale (browser rotates keys, drops the sub, etc.) and a
// device that looks "on" silently receives nothing. This re-registers the
// service worker, re-subscribes fresh against the current key, and fires a test
// so you can SEE it land — the one-tap self-heal, no settings spelunking.
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}

export function NotificationFix() {
  const [status, setStatus] = useState<"on" | "off" | "denied" | "unsupported" | "unknown">(
    "unknown",
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  async function refresh() {
    const perm = pushPermission();
    if (perm === "unsupported") return setStatus("unsupported");
    if (perm === "denied") return setStatus("denied");
    setStatus((await deviceSubscribed()) ? "on" : "off");
  }

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIOSDevice());
    void refresh();
  }, []);

  // When blocked, "fixing" from the page can't work — the browser won't re-prompt
  // a denied permission. So after the user allows it in settings and returns,
  // this re-reads the permission and, if it's now allowed, subscribes + tests.
  async function recheck() {
    if (busy) return;
    setMsg(null);
    if (pushPermission() === "denied") {
      setMsg("Still blocked — allow notifications in your settings (steps above), then tap Recheck.");
      return;
    }
    await fix();
  }

  async function fix() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      // Grant + subscribe if needed, then always re-subscribe fresh to clear any
      // stale subscription bound to an old key.
      const r = await enablePush();
      if (r === "denied") {
        setStatus("denied");
        setMsg(null);
        return;
      }
      if (r === "unsupported") {
        setStatus("unsupported");
        return;
      }
      await healPush();
      await refresh();
      const shown = await showLocalNotification(
        "ThinkThru 🌱",
        "Notifications are working on this device.",
      );
      setMsg(
        shown
          ? "Re-subscribed ✓ — you should have just seen a test notification."
          : "Re-subscribed ✓. If nothing arrives, check this device's notification settings for ThinkThru.",
      );
    } catch {
      setMsg("Couldn't fix it here — try reloading, then tap again.");
    } finally {
      setBusy(false);
    }
  }

  // If it's genuinely working, keep this quiet but still available as a tiny line.
  const label =
    status === "denied"
      ? "Notifications are blocked for ThinkThru"
      : status === "unsupported"
        ? "This browser can't do notifications — install the app to your home screen"
        : status === "on"
          ? "Notifications on. Not arriving? Re-subscribe this device"
          : "Notifications aren't set up on this device";

  if (status === "unsupported") {
    return (
      <div className="mb-5 rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <p className="text-sm text-ink">🔔 {label}</p>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-2xl border border-[rgba(76,175,80,0.25)] bg-[rgba(76,175,80,0.05)] p-4">
      <p className="text-sm font-medium text-ink">🔔 Notifications not arriving?</p>
      <p className="mt-0.5 text-xs text-ink-soft">{label}.</p>
      {status === "denied" ? (
        <div className="mt-2 text-xs leading-relaxed text-ink-soft">
          {installed ? (
            ios ? (
              <>
                Open your phone&apos;s{" "}
                <span className="text-ink">Settings → Notifications → ThinkThru</span> and turn on{" "}
                <span className="text-ink">Allow Notifications</span>. Then come back and tap Recheck.
              </>
            ) : (
              <>
                Open your phone&apos;s{" "}
                <span className="text-ink">Settings → Apps → ThinkThru → Notifications</span> and
                allow them (or long-press the ThinkThru icon → App info → Notifications). Then come
                back and tap Recheck.
              </>
            )
          ) : ios ? (
            <>
              On iPhone, add ThinkThru to your Home Screen first (Share → Add to Home Screen), open
              it from that icon, then allow notifications.
            </>
          ) : (
            <>
              Tap the <span className="text-ink">🔒 lock</span> (or the ⋮ menu) next to the address
              bar → <span className="text-ink">Site settings → Notifications → Allow</span>, then
              reload and tap Recheck.
            </>
          )}
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        {status === "denied" ? (
          <button onClick={recheck} disabled={busy} className="btn-primary text-sm disabled:opacity-60">
            {busy ? "Checking…" : "Recheck"}
          </button>
        ) : (
          <button onClick={fix} disabled={busy} className="btn-primary text-sm disabled:opacity-60">
            {busy ? "Fixing…" : status === "on" ? "Re-subscribe & test" : "Fix notifications"}
          </button>
        )}
      </div>
      {msg && <p className="mt-2 text-xs text-ink-mid">{msg}</p>}
    </div>
  );
}
