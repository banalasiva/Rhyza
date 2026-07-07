"use client";

import { useState } from "react";
import { EXPLORE_TOPICS } from "@/lib/constants";

// Lets a person curate the topics shown on their own profile — add ones Claude
// missed, remove ones they'd rather not show. Saving writes the set to their
// interests (which also tunes what they hear about); an empty set falls back to
// Claude's auto-inferred topics.
export function ProfileTopicsEditor({ initialKeys }: { initialKeys: string[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialKeys));
  const [saving, setSaving] = useState(false);

  function toggle(key: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/me/interests", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topics: [...selected] }),
      });
      window.location.reload();
    } catch {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-xs text-ink-soft transition hover:text-accent"
      >
        ✏️ Edit topics
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-[rgba(76,175,80,0.2)] p-3">
      <p className="mb-2 text-xs text-ink-soft">Tap to add or remove the topics on your profile:</p>
      <div className="flex flex-wrap gap-2">
        {EXPLORE_TOPICS.map((t) => {
          const on = selected.has(t.key);
          return (
            <button
              key={t.key}
              onClick={() => toggle(t.key)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition"
              style={
                on
                  ? { borderColor: "var(--accent)", background: "var(--accent)", color: "var(--bg)" }
                  : { borderColor: "var(--border)", color: "var(--ink-soft)" }
              }
            >
              <span aria-hidden>{t.emoji}</span> {t.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={save} disabled={saving} className="btn-primary text-xs disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setOpen(false)} className="btn-ghost text-xs">
          Cancel
        </button>
        <span className="text-[11px] text-ink-soft">Clear all to use auto topics.</span>
      </div>
    </div>
  );
}
