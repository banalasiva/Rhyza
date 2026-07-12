"use client";

import { useEffect, useState } from "react";
import {
  enablePush,
  disablePush,
  healPush,
  reconnectPush,
  pushPermission,
  deviceSubscribed,
  showLocalNotification,
} from "@/lib/push-client";

type Prefs = { emailNotify: boolean; pushNotify: boolean; digestNotify: boolean };

function Toggle({
  label,
  hint,
  on,
  busy,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  busy?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 py-2 text-left disabled:opacity-60"
    >
      <span>
        <span className="block text-sm text-ink">{label}</span>
        <span className="block text-xs text-ink-soft">{busy ? "…" : hint}</span>
      </span>
      <span
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${
          on ? "bg-[#4CAF50]" : "bg-[rgba(255,255,255,0.14)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function NotificationSettings({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushDenied, setPushDenied] = useState(false);
  const [pushUnsupported, setPushUnsupported] = useState(false);
  // Whether THIS device is actually subscribed (browser permission granted) —
  // not the account-wide pref. A device where permission was never granted must
  // read OFF so turning it on triggers the permission prompt + subscribe.
  const [deviceOn, setDeviceOn] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  // Set when a real push was rejected (e.g. the subscription expired — 410/403).
  // Surfaces a one-tap "Reconnect this device" action, the actual remedy.
  const [needsReconnect, setNeedsReconnect] = useState(false);

  // On load: reflect whether THIS device is actually subscribed. If it is, keep
  // its subscription fresh (heals an old-key one) and self-correct the account
  // pref — a subscribed device should never be left muted account-wide.
  useEffect(() => {
    (async () => {
      const p = pushPermission();
      if (p === "unsupported") {
        setPushUnsupported(true);
        return;
      }
      if (p === "denied") {
        setPushDenied(true);
        return;
      }
      const subbed = await deviceSubscribed();
      setDeviceOn(subbed);
      if (subbed) {
        await healPush();
        if (!prefs.pushNotify) update({ pushNotify: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function update(patch: Partial<Prefs>) {
    const prev = prefs;
    setPrefs({ ...prefs, ...patch }); // optimistic
    setSaving(true);
    try {
      const res = await fetch("/api/me/notification-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) setPrefs(prev); // roll back
    } catch {
      setPrefs(prev); // roll back
    } finally {
      setSaving(false);
    }
  }

  // The push toggle is the single control: turning it on subscribes this device
  // (asking the browser's permission), turning it off unsubscribes it. The saved
  // pref follows along.
  async function togglePush(on: boolean) {
    setPushBusy(true);
    setTestMsg(null);
    try {
      if (on) {
        const r = await enablePush();
        if (r === "on") {
          setPushDenied(false);
          setDeviceOn(true);
          await update({ pushNotify: true });
        } else if (r === "denied") {
          setPushDenied(true);
          setDeviceOn(false);
        } else if (r === "unsupported") {
          setPushUnsupported(true);
        }
      } else {
        // Unsubscribe THIS device only. We deliberately do NOT set
        // pushNotify=false — that's account-wide and would silence your other
        // devices too. With no subscription here, this device simply won't be
        // pushed.
        await disablePush();
        setDeviceOn(false);
      }
    } finally {
      setPushBusy(false);
    }
  }

  // The self-test: make sure THIS device is enabled, show a notification on it
  // immediately (reliable, no push round-trip), and also exercise the real push
  // pipeline to every subscribed device.
  async function sendTest() {
    setTesting(true);
    setTestMsg(null);
    setNeedsReconnect(false);
    try {
      // Enable this device first if it isn't already (prompts permission).
      if (!deviceOn) {
        const r = await enablePush();
        if (r === "denied") {
          setPushDenied(true);
          setTestMsg("Notifications are blocked — allow them for this site in your browser, then tap again.");
          return;
        }
        if (r === "unsupported") {
          setPushUnsupported(true);
          return;
        }
        setDeviceOn(true);
        setPushDenied(false);
        await update({ pushNotify: true });
      }

      // Instant, local — proves this device CAN display notifications (but this
      // is not proof that push delivery works; that's the real pipeline below).
      const shown = await showLocalNotification(
        "ThinkThru 🔔",
        "Your notifications are working on this device.",
      );

      // The real test: push through the server to every subscribed device.
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      const delivered = res.ok && (data.sent ?? 0) > 0;

      if (delivered) {
        setTestMsg(
          `✓ Delivered to ${data.sent}/${data.devices} device${data.devices === 1 ? "" : "s"} — check your notifications.`,
        );
      } else {
        // Push failed. Don't call it success just because the local one showed —
        // that masked the real failure before. Point to the actual fix.
        const serverMsg = (data?.error?.message as string) ?? "";
        const noDevice = /no device/i.test(serverMsg);
        setNeedsReconnect(!noDevice);
        setTestMsg(
          noDevice
            ? "This device isn't subscribed yet. Turn on Push notifications above, allow them, then try again."
            : shown
              ? "This device can show notifications, but its link to our server has expired — so pushes won't arrive. Tap Reconnect below, then test again."
              : "Notifications couldn't be delivered — this device's link to our server has expired. Tap Reconnect below, then test again.",
        );
      }
    } catch {
      setTestMsg("Couldn't run the test — check your connection and try again.");
    } finally {
      setTesting(false);
    }
  }

  // Push today's actual quote to this person's devices, on demand — the daily
  // "Good morning 🌱" push, felt right now. Enables this device first if needed.
  async function sendQuote() {
    setQuoting(true);
    setTestMsg(null);
    setNeedsReconnect(false);
    try {
      if (!deviceOn) {
        const r = await enablePush();
        if (r === "denied") {
          setPushDenied(true);
          setTestMsg("Notifications are blocked — allow them for this site in your browser, then tap again.");
          return;
        }
        if (r === "unsupported") {
          setPushUnsupported(true);
          return;
        }
        setDeviceOn(true);
        setPushDenied(false);
        await update({ pushNotify: true });
      }
      const res = await fetch("/api/push/quote", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      const delivered = res.ok && (data.sent ?? 0) > 0;

      if (delivered) {
        setTestMsg(
          `🌱 Sent today's quote to ${data.sent}/${data.devices} device${data.devices === 1 ? "" : "s"} — check your notifications.`,
        );
      } else {
        const serverMsg = (data?.error?.message as string) ?? "";
        const noDevice = /no device/i.test(serverMsg);
        setNeedsReconnect(!noDevice);
        setTestMsg(
          noDevice
            ? "This device isn't subscribed yet. Turn on Push notifications above, allow them, then try again."
            : "Couldn't deliver — this device's link to our server has expired. Tap Reconnect below, then try again.",
        );
      }
    } catch {
      setTestMsg("Couldn't send the quote — check your connection and try again.");
    } finally {
      setQuoting(false);
    }
  }

  // The remedy for a rejected push: tear down the stale subscription and mint a
  // fresh one, without the user hunting through browser settings.
  async function reconnect() {
    setPushBusy(true);
    setTestMsg("Reconnecting this device…");
    try {
      const r = await reconnectPush();
      if (r === "on") {
        setDeviceOn(true);
        setPushDenied(false);
        setNeedsReconnect(false);
        await update({ pushNotify: true });
        setTestMsg("✓ Reconnected. Tap “🔔 Send a test notification” to confirm it arrives.");
      } else if (r === "denied") {
        setPushDenied(true);
        setNeedsReconnect(false);
        setTestMsg("Notifications are blocked in your browser — allow them for this site, then reconnect.");
      } else if (r === "unsupported") {
        setPushUnsupported(true);
      } else {
        setTestMsg("Couldn't reconnect — try turning Push notifications off and back on above.");
      }
    } finally {
      setPushBusy(false);
    }
  }

  const pushOn = deviceOn && !pushDenied && !pushUnsupported;

  return (
    <div className="card mb-6 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">How you hear about activity</h2>
        {saving && <span className="text-xs text-ink-soft">saving…</span>}
      </div>
      <div className="divide-y divide-[rgba(255,255,255,0.06)]">
        {pushUnsupported ? (
          <p className="py-2 text-xs text-ink-soft">
            This browser can’t do push notifications. You’ll still get email for the big moments.
          </p>
        ) : (
          <Toggle
            label="Push notifications"
            hint={
              pushDenied
                ? "Blocked in your browser settings — allow notifications for this site, then turn this on."
                : "Instant alerts on this phone or computer."
            }
            on={pushOn}
            busy={pushBusy}
            onChange={togglePush}
          />
        )}
        <Toggle
          label="Email for the big moments"
          hint="When your seed blooms, you're mentioned, or your point lands."
          on={prefs.emailNotify}
          onChange={(v) => update({ emailNotify: v })}
        />
        <Toggle
          label="Daily digest email"
          hint="One calm roundup a day of everything else."
          on={prefs.digestNotify}
          onChange={(v) => update({ digestNotify: v })}
        />
      </div>

      {!pushUnsupported && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[rgba(255,255,255,0.06)] pt-3">
          <button
            type="button"
            onClick={sendTest}
            disabled={testing || quoting}
            className="rounded-full border border-[rgba(76,175,80,0.3)] px-3 py-1.5 text-xs text-accent transition hover:text-ink disabled:opacity-50"
          >
            {testing ? "Sending…" : "🔔 Send a test notification"}
          </button>
          <button
            type="button"
            onClick={sendQuote}
            disabled={testing || quoting}
            className="rounded-full border border-[rgba(76,175,80,0.3)] px-3 py-1.5 text-xs text-accent transition hover:text-ink disabled:opacity-50"
          >
            {quoting ? "Sending…" : "🌱 Send me today's quote"}
          </button>
          {needsReconnect && (
            <button
              type="button"
              onClick={reconnect}
              disabled={pushBusy}
              className="rounded-full bg-[#4CAF50] px-3 py-1.5 text-xs font-medium text-[#06120a] transition hover:brightness-110 disabled:opacity-50"
            >
              {pushBusy ? "Reconnecting…" : "🔄 Reconnect this device"}
            </button>
          )}
          {testMsg && <span className="w-full text-xs text-ink-soft">{testMsg}</span>}
        </div>
      )}
    </div>
  );
}
