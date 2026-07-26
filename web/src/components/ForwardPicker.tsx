"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/client";

type Seed = { id: string; title: string; visibility: "public" | "private"; bloomed: boolean };
type Garden = {
  id: string;
  name: string;
  emoji: string;
  visibility: "public" | "private";
  seeds: Seed[];
};

// A destination picker for forwarding a message. Lists your decisions grouped by
// garden (relationship group), searchable. Tap to SELECT several, then Forward
// sends the message's text + media to all of them at once. Bloomed (closed)
// seeds and the current seed are excluded.
export function ForwardPicker({
  contributionId,
  excludeSeedId,
  onClose,
}: {
  contributionId: string;
  excludeSeedId: string;
  onClose: () => void;
}) {
  const [gardens, setGardens] = useState<Garden[] | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/tree", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setGardens(j?.gardens ?? j?.data?.gardens ?? []))
      .catch(() => setGardens([]));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (error) setError(null);
  }

  async function send() {
    if (selected.size === 0 || sending) return;
    setSending(true);
    setError(null);
    const ids = [...selected];
    const results = await Promise.allSettled(
      ids.map((id) => apiPost(`/api/seeds/${id}/forward`, { contributionId })),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    if (ok === 0) {
      setSending(false);
      setError("Couldn't forward it just now — try again.");
      return;
    }
    setDone(ok);
    setTimeout(onClose, 1200);
  }

  const ql = q.trim().toLowerCase();
  const filtered = (gardens ?? [])
    .map((g) => ({
      ...g,
      seeds: g.seeds.filter(
        (s) =>
          s.id !== excludeSeedId &&
          !s.bloomed &&
          (!ql || s.title.toLowerCase().includes(ql) || g.name.toLowerCase().includes(ql)),
      ),
    }))
    .filter((g) => g.seeds.length > 0);

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center sm:items-center">
      <button
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Forward to"
        className="relative z-10 flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-2xl border border-[rgba(76,175,80,0.2)] bg-[#0B120B] shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-sm font-semibold text-ink">↪ Forward to…</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-soft transition hover:text-ink">
            ✕
          </button>
        </div>

        {done ? (
          <p className="px-4 py-8 text-center text-sm text-accent">
            ✓ Forwarded to {done} {done === 1 ? "decision" : "decisions"}
          </p>
        ) : (
          <>
            <div className="px-4">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search your decisions…"
                className="input w-full text-sm"
              />
              {error && <p className="mt-2 text-xs text-[#e57373]">{error}</p>}
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
              {gardens === null && <p className="py-4 text-sm text-ink-soft">Loading…</p>}
              {gardens && filtered.length === 0 && (
                <p className="py-4 text-center text-xs text-ink-soft">
                  No other decisions to forward to yet — start one first 🌱
                </p>
              )}
              <div className="space-y-4">
                {filtered.map((g) => (
                  <div key={g.id}>
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-soft">
                      <span aria-hidden>{g.emoji}</span>
                      <span className="truncate">{g.name}</span>
                    </p>
                    <div className="space-y-1">
                      {g.seeds.map((s) => {
                        const on = selected.has(s.id);
                        return (
                          <button
                            key={s.id}
                            onClick={() => toggle(s.id)}
                            aria-pressed={on}
                            className={
                              "flex w-full items-center gap-2 rounded-xl border p-3 text-left transition " +
                              (on
                                ? "border-accent bg-[rgba(76,175,80,0.1)]"
                                : "border-[rgba(255,255,255,0.06)] bg-[rgba(7,13,7,0.35)] hover:border-accent")
                            }
                          >
                            {/* Selection tick */}
                            <span
                              className={
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] " +
                                (on
                                  ? "border-accent bg-accent text-[#07120a]"
                                  : "border-[rgba(255,255,255,0.2)] text-transparent")
                              }
                              aria-hidden
                            >
                              ✓
                            </span>
                            <span className="shrink-0 text-xs" aria-hidden>
                              {s.visibility === "private" ? "🔒" : "🌱"}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-ink">{s.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sticky action bar — clears the fixed bottom nav so the button is
                never hidden behind it. */}
            <div className="border-t border-[rgba(255,255,255,0.08)] p-4 pb-[calc(1rem+4.75rem+env(safe-area-inset-bottom))]">
              <button
                onClick={send}
                disabled={selected.size === 0 || sending}
                className="btn-primary w-full text-sm disabled:opacity-50"
              >
                {sending
                  ? "Forwarding…"
                  : selected.size === 0
                    ? "Select where to forward"
                    : `Forward to ${selected.size} →`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
