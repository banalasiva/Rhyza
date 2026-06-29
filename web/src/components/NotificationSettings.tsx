"use client";

import { useEffect, useState } from "react";
import { enablePush, disablePush, healPush, pushPermission, deviceSubscribed } from "@/lib/push-client";

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

  async function sendTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const failed = Array.isArray(data.failures) ? data.failures.length : 0;
        setTestMsg(
          `Sent to ${data.sent}/${data.devices} device${data.devices === 1 ? "" : "s"} — check your notifications.` +
            (failed ? " (1 device was stale and has been refreshed — try again.)" : ""),
        );
      } else {
        setTestMsg(data?.error?.message ?? "Couldn't send a test.");
      }
    } catch {
      setTestMsg("Couldn't send a test.");
    } finally {
      setTesting(false);
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

      {pushOn && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[rgba(255,255,255,0.06)] pt-3">
          <button
            type="button"
            onClick={sendTest}
            disabled={testing}
            className="rounded-full border border-[rgba(76,175,80,0.3)] px-3 py-1.5 text-xs text-accent transition hover:text-ink disabled:opacity-50"
          >
            {testing ? "Sending…" : "🔔 Send a test notification"}
          </button>
          {testMsg && <span className="text-xs text-ink-soft">{testMsg}</span>}
        </div>
      )}
    </div>
  );
}
