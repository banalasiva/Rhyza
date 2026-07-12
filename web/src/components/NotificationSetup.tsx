"use client";

import { useEffect, useState } from "react";
import {
  pushPermission,
  deviceSubscribed,
  enablePush,
  reconnectPush,
  showLocalNotification,
} from "@/lib/push-client";

// The one-time "get notifications actually working" step. Unlike a dismissible
// banner, it keeps showing until this device is genuinely subscribed — because
// that's the whole game. It adapts to what's actually blocking delivery:
//   • iPhone in a browser tab → push CAN'T work until the app is on the home
//     screen, so we guide that first.
//   • Permission not granted / no subscription → one-tap turn-on.
//   • Blocked → how to unblock.
//   • Working → a quick "send a test" so they SEE it land, then it steps aside.

const SNOOZE_KEY = "tt-notif-setup-snooze";
const SNOOZE_MS = 24 * 60 * 60 * 1000; // 1 day only — notifications are the point

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}
function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

type Step = "loading" | "hidden" | "install" | "enable" | "denied" | "verify" | "done" | "failed";

export function NotificationSetup() {
  const [step, setStep] = useState<Step>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const perm = pushPermission();
      if (perm === "unsupported") return alive && setStep("hidden");
      const subscribed = await deviceSubscribed();
      if (perm === "on" && subscribed) return alive && setStep("hidden"); // already working
      if (perm === "denied") return alive && setStep("denied");
      if (snoozed()) return alive && setStep("hidden");
      // On iPhone, push is impossible in a browser tab — must be installed first.
      if (isIOS() && !isStandalone()) return alive && setStep("install");
      return alive && setStep("enable");
    })();
    return () => {
      alive = false;
    };
  }, []);

  function snooze() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setStep("hidden");
  }

  async function enable() {
    setBusy(true);
    try {
      const r = await enablePush();
      if (r === "on") await verify();
      else if (r === "denied") setStep("denied");
      else setStep("hidden");
    } finally {
      setBusy(false);
    }
  }

  // Auto-verify: after enabling, actually push through the SERVER to this device
  // and confirm it was delivered (sent > 0) — not just that a local notification
  // can display. This is what catches a subscription that looks on but is dead.
  async function verify() {
    setStep("verify");
    // A friendly immediate cue while the real push travels (best-effort).
    showLocalNotification("ThinkThru 🌱", "Checking your notifications…").catch(() => {});
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setStep(res.ok && (data.sent ?? 0) > 0 ? "done" : "failed");
    } catch {
      setStep("failed");
    }
  }

  // The remedy when the test doesn't arrive: rebuild the subscription (even a
  // stale one the browser still thinks is fine), then verify again.
  async function reconnectAndRetry() {
    setBusy(true);
    try {
      const r = await reconnectPush();
      if (r === "denied") setStep("denied");
      else if (r === "on") await verify();
      else setStep("failed");
    } finally {
      setBusy(false);
    }
  }

  if (step === "loading" || step === "hidden") return null;

  return (
    <div className="mb-5 rounded-2xl border border-[rgba(76,175,80,0.3)] bg-[rgba(76,175,80,0.07)] p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          🔔
        </span>
        <div className="min-w-0 flex-1">
          {step === "install" && (
            <>
              <p className="text-sm font-medium text-ink">Add ThinkThru to your Home Screen</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                On iPhone, notifications only work from the installed app. Tap the{" "}
                <span className="text-ink">Share</span> button (the square with an arrow ↑), then{" "}
                <span className="text-ink">Add to Home Screen</span> — open ThinkThru from that icon
                and turn on notifications there.
              </p>
              <div className="mt-3">
                <button onClick={snooze} className="btn-ghost text-xs">
                  Later
                </button>
              </div>
            </>
          )}

          {step === "enable" && (
            <>
              <p className="text-sm font-medium text-ink">Turn on notifications</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                So you hear the moment someone replies, reacts, plants a seed, or asks for your take —
                instead of having to keep checking.
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={enable} disabled={busy} className="btn-primary text-sm disabled:opacity-60">
                  {busy ? "Turning on…" : "Turn on notifications"}
                </button>
                <button onClick={snooze} className="btn-ghost text-xs">
                  Later
                </button>
              </div>
            </>
          )}

          {step === "denied" && (
            <>
              <p className="text-sm font-medium text-ink">Notifications are blocked</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                Your browser is blocking them for ThinkThru. Open the site settings (tap the lock/ⓘ
                by the address, or your app settings), allow Notifications, then reload — that&apos;s
                the only way replies and nudges can reach this device.
              </p>
              <div className="mt-3">
                <button onClick={snooze} className="btn-ghost text-xs">
                  Dismiss
                </button>
              </div>
            </>
          )}

          {step === "verify" && (
            <>
              <p className="text-sm font-medium text-ink">Making sure it actually arrives…</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                Sending a real notification to this device — one moment.
              </p>
            </>
          )}

          {step === "done" && (
            <>
              <p className="text-sm font-medium text-ink">You&apos;re all set 🎉</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                Verified — a real notification just landed on this device. ThinkThru will reach you.
              </p>
              <div className="mt-3">
                <button onClick={() => setStep("hidden")} className="btn-primary text-sm">
                  Done
                </button>
              </div>
            </>
          )}

          {step === "failed" && (
            <>
              <p className="text-sm font-medium text-ink">Almost there — the test didn&apos;t arrive</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                This device&apos;s link to our server has expired, so pushes won&apos;t come through
                yet. Reconnect to fix it — takes a second.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={reconnectAndRetry}
                  disabled={busy}
                  className="btn-primary text-sm disabled:opacity-60"
                >
                  {busy ? "Reconnecting…" : "🔄 Reconnect & retry"}
                </button>
                <button onClick={snooze} className="btn-ghost text-xs">
                  Later
                </button>
              </div>
            </>
          )}
        </div>
        {(step === "install" || step === "denied") && (
          <button
            onClick={snooze}
            aria-label="Dismiss"
            className="shrink-0 rounded-full px-1.5 text-ink-soft transition hover:text-ink"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
