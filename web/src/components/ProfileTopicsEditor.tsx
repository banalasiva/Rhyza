"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client";

// Lets a person curate the free-form topics on their own profile: remove ones
// that don't fit, add their own, or ask Claude to re-read their activity and
// name the areas fresh. Manual additions survive a refresh.
export function ProfileTopicsEditor({ initial }: { initial: string[] }) {
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // which action is running

  async function run(body: { action: "refresh" | "add" | "remove"; topic?: string }, tag: string) {
    setBusy(tag);
    try {
      const r = await apiPost<{ topics: string[] }>("/api/me/topics", body);
      setTopics(r.topics);
    } catch {
      /* leave the list as-is on failure */
    } finally {
      setBusy(null);
    }
  }

  function add() {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    run({ action: "add", topic: t }, "add");
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
      <p className="mb-2 text-xs text-ink-soft">
        These are the areas you&apos;re mostly involved in. Remove any that don&apos;t fit, add your
        own, or refresh from your activity.
      </p>

      {topics.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(76,175,80,0.2)] bg-[rgba(76,175,80,0.05)] px-3 py-1 text-xs text-ink-mid"
            >
              {t}
              <button
                onClick={() => run({ action: "remove", topic: t }, `rm:${t}`)}
                disabled={!!busy}
                aria-label={`Remove ${t}`}
                className="text-ink-soft transition hover:text-ink disabled:opacity-50"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink-soft">No topics yet — add one or refresh from your activity.</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a topic…"
          maxLength={40}
          className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-transparent px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
        />
        <button
          onClick={add}
          disabled={!!busy || !draft.trim()}
          className="btn-ghost text-xs disabled:opacity-50"
        >
          {busy === "add" ? "Adding…" : "Add"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => run({ action: "refresh" }, "refresh")}
          disabled={!!busy}
          className="btn-ghost text-xs disabled:opacity-50"
        >
          {busy === "refresh" ? "Refreshing…" : "🔄 Refresh from my activity"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-ink-soft hover:text-ink">
          Done
        </button>
      </div>
    </div>
  );
}
