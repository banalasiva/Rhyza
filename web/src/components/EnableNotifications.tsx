"use client";

import { useEffect, useState } from "react";
import { pushPermission, deviceSubscribed, enablePush } from "@/lib/push-client";

// A gentle one-tap "turn on notifications" nudge. Most people never open
// settings, so their notifications are on by default account-wide but this
// device was never actually subscribed — nothing can reach them. This surfaces
// the permission prompt right where they land, so the morning hello and replies
// actually arrive. Shows only when the browser can be asked (permission still
// "off") and this device isn't subscribed; snoozes for a week on dismiss.
const SNOOZE_KEY = "tt-notif-snooze";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

export function EnableNotifications() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (snoozed()) return;
    // "off" = the browser hasn't been asked yet (askable). "denied"/"unsupported"
    // /"on" all mean there's nothing useful to nudge here.
    if (pushPermission() !== "off") return;
    deviceSubscribed().then((sub) => {
      if (!sub) setShow(true);
    });
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  async function enable() {
    setBusy(true);
    try {
      const r = await enablePush();
      if (r === "on") setShow(false);
      else if (r === "denied") setDenied(true);
      else setShow(false); // unsupported — nothing more to do here
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5 rounded-2xl border border-[rgba(76,175,80,0.3)] bg-[rgba(76,175,80,0.07)] p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          🔔
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Turn on notifications</p>
          {denied ? (
            <p className="mt-0.5 text-xs text-ink-soft">
              Notifications are blocked for this app. Allow them in your browser/app settings, then
              reload — that&apos;s the only way replies and the morning hello can reach you.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-ink-soft">
              So you hear back when someone replies, a decision lands, or the morning hello arrives —
              instead of having to keep checking.
            </p>
          )}
          {!denied && (
            <div className="mt-3 flex gap-2">
              <button onClick={enable} disabled={busy} className="btn-primary text-sm disabled:opacity-60">
                {busy ? "Turning on…" : "Turn on"}
              </button>
              <button onClick={dismiss} className="btn-ghost text-xs">
                Not now
              </button>
            </div>
          )}
        </div>
        {denied && (
          <button
            onClick={dismiss}
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
