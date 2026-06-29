"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EXPLORE_TOPICS } from "@/lib/constants";
import { apiPatch } from "@/lib/client";

// Lets a person choose the topics they care about. Their picks personalise the
// Explore feed and decide which "new public seed" pings they get. Saves on each
// toggle (debounced via a short save lock) and refreshes the feed order.
export function InterestPicker({ initial }: { initial: string[] }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Set<string>>(new Set(initial));
  const [open, setOpen] = useState(initial.length === 0);
  const [saving, setSaving] = useState(false);

  async function toggle(key: string) {
    const next = new Set(chosen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setChosen(next);
    setSaving(true);
    try {
      await apiPatch("/api/me/interests", { topics: [...next] });
      router.refresh(); // re-rank the feed for the new interests
    } catch {
      // revert on failure
      setChosen(chosen);
    } finally {
      setSaving(false);
    }
  }

  const count = chosen.size;

  return (
    <div className="card mb-6 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span>
          <span className="eyebrow">✨ Your interests</span>
          <span className="mt-0.5 block text-sm text-ink-mid">
            {count > 0
              ? `Personalising your feed by ${count} topic${count > 1 ? "s" : ""}.`
              : "Pick a few topics to personalise your feed and get notified about new seeds."}
          </span>
        </span>
        <span className="shrink-0 text-xs text-ink-soft">
          {saving ? "Saving…" : open ? "Done" : "Edit"}
        </span>
      </button>

      {open && (
        <div className="mt-4 flex flex-wrap gap-2">
          {EXPLORE_TOPICS.map((t) => {
            const on = chosen.has(t.key);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => toggle(t.key)}
                aria-pressed={on}
                className={
                  "rounded-full border px-3 py-1.5 text-xs transition " +
                  (on
                    ? "border-accent bg-[rgba(76,175,80,0.16)] text-ink"
                    : "border-[rgba(255,255,255,0.12)] text-ink-soft hover:border-[rgba(76,175,80,0.4)]")
                }
              >
                {t.emoji} {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
