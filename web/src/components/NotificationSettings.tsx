"use client";

import { useState } from "react";
import { EnableNotifications } from "@/components/EnableNotifications";

type Prefs = { emailNotify: boolean; pushNotify: boolean; digestNotify: boolean };

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 py-2 text-left"
    >
      <span>
        <span className="block text-sm text-ink">{label}</span>
        <span className="block text-xs text-ink-soft">{hint}</span>
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

  async function update(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next); // optimistic
    setSaving(true);
    try {
      await fetch("/api/me/notification-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      setPrefs(prefs); // roll back
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card mb-6 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">How you hear about activity</h2>
        {saving && <span className="text-xs text-ink-soft">saving…</span>}
      </div>
      <div className="mb-3">
        <EnableNotifications />
      </div>
      <div className="divide-y divide-[rgba(255,255,255,0.06)]">
        <Toggle
          label="Push notifications"
          hint="Instant alerts on this phone or computer."
          on={prefs.pushNotify}
          onChange={(v) => update({ pushNotify: v })}
        />
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
    </div>
  );
}
