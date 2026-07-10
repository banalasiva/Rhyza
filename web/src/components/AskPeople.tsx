"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client";
import { Avatar } from "@/components/Avatar";

type Person = { id: string; name: string; email: string; image: string | null };

// "Ask someone" — point this seed at specific people by name. They get a
// personal summons ("Siva is asking for your take"), it lands in their "It's
// your turn", and when they answer, you hear about it. The interpersonal pull
// that actually brings people back.
export function AskPeople({ seedId }: { seedId: string }) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || people) return;
    apiGet<{ people: Person[] }>(`/api/seeds/${seedId}/ask`)
      .then((r) => setPeople(r.people))
      .catch(() => setError("Couldn't load your people"));
  }, [open, people, seedId]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function send() {
    if (picked.size === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiPost<{ asked: number }>(`/api/seeds/${seedId}/ask`, {
        userIds: [...picked],
      });
      setDone(
        r.asked > 0
          ? `Asked ${r.asked} ${r.asked === 1 ? "person" : "people"} 🌱`
          : "Couldn't ask them — are they in your circle?",
      );
      setPicked(new Set());
      setTimeout(() => {
        setOpen(false);
        setDone(null);
      }, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const filtered = (people ?? []).filter((p) =>
    q.trim() ? p.name.toLowerCase().includes(q.trim().toLowerCase()) : true,
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
      >
        🙋 Ask someone
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Ask someone to weigh in"
            className="relative z-10 max-h-[85vh] w-full max-w-md overflow-auto rounded-t-2xl border border-[rgba(76,175,80,0.2)] bg-[#0B120B] p-4 shadow-2xl sm:rounded-2xl"
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">🙋 Ask someone to weigh in</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-ink-soft transition hover:text-ink"
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-[11px] text-ink-soft">
              They&apos;ll get a personal nudge and this lands in their “It&apos;s your turn.”
            </p>

            {error && <p className="mb-2 text-xs text-[#e57373]">{error}</p>}
            {done ? (
              <p className="py-6 text-center text-sm text-accent">{done}</p>
            ) : (
              <>
                {people && people.length > 6 && (
                  <input
                    className="input mb-3"
                    placeholder="Search your people…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                )}
                {!people && !error && <p className="text-sm text-ink-soft">Loading…</p>}
                {people && filtered.length === 0 && (
                  <p className="text-sm text-ink-soft">
                    No one here yet — invite people to a garden first.
                  </p>
                )}
                <ul className="space-y-1">
                  {filtered.map((p) => {
                    const on = picked.has(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          onClick={() => toggle(p.id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                            on ? "bg-[rgba(76,175,80,0.14)]" : "hover:bg-white/5"
                          }`}
                        >
                          <Avatar name={p.name} image={p.image} size={30} />
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
                          <span
                            className={`shrink-0 text-xs ${on ? "text-accent" : "text-ink-soft"}`}
                          >
                            {on ? "✓ Selected" : "Select"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <button
                  onClick={send}
                  disabled={picked.size === 0 || busy}
                  className="btn-primary mt-4 w-full text-sm disabled:opacity-50"
                >
                  {busy
                    ? "Asking…"
                    : picked.size === 0
                      ? "Pick someone to ask"
                      : `Ask ${picked.size} ${picked.size === 1 ? "person" : "people"}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
