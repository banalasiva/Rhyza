"use client";

import { useRef, useState } from "react";

// Bloom 2.0 — a quiet conversation with your future self. Not a form: three
// gentle prompts you return to whenever reality has taught you something. Each
// answer autosaves on its own, so there's never a "submit" — you just leave a
// mark and come back. Only you ever see this.

type Reflection = {
  outcome: string | null;
  outcomeNote: string | null;
  lesson: string | null;
  sameAgain: string | null;
  changed: string | null;
  updatedAt: string | null;
};

const OUTCOMES: { key: string; label: string }[] = [
  { key: "better", label: "Better than expected" },
  { key: "expected", label: "About as expected" },
  { key: "worse", label: "Worse than expected" },
];

const SAME_AGAIN: { key: string; label: string }[] = [
  { key: "definitely_yes", label: "Definitely yes" },
  { key: "probably_yes", label: "Probably yes" },
  { key: "not_sure", label: "Not sure" },
  { key: "probably_no", label: "Probably no" },
  { key: "definitely_no", label: "Definitely no" },
];

export function BloomReflection({ bloomId, initial }: { bloomId: string; initial: Reflection }) {
  const [r, setR] = useState<Reflection>(initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const savingRef = useRef(false);

  // Save a partial patch; merge the returned reflection back in. Optimistic for
  // choices (instant), on-blur for the notes — never a form submit.
  async function save(patch: Partial<Reflection>) {
    setR((prev) => ({ ...prev, ...patch }));
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const res = await fetch(`/api/blooms/${bloomId}/reflect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as Reflection | null;
        if (data?.updatedAt) setR((prev) => ({ ...prev, updatedAt: data.updatedAt }));
        setSavedAt(Date.now());
      }
    } catch {
      /* best-effort — the value stays on screen; a later edit retries */
    } finally {
      savingRef.current = false;
    }
  }

  const pill = (active: boolean) =>
    `rounded-full border px-3.5 py-2 text-sm transition ${
      active
        ? "border-bloom bg-[rgba(255,179,0,0.12)] text-bloom"
        : "border-[rgba(255,255,255,0.14)] text-ink-mid hover:text-ink"
    }`;

  return (
    <section className="mt-8">
      <div className="mb-4 text-center">
        <p className="eyebrow mb-1" style={{ color: "#FFB300" }}>
          🌱 Looking back
        </p>
        <h2 className="serif-lg mb-1">What did reality teach you?</h2>
        <p className="mx-auto max-w-md text-sm text-ink-mid">
          A bloom keeps growing. Come back whenever life has an answer — no rush, nothing to submit,
          and only you can see this.
        </p>
      </div>

      <div className="space-y-3">
        {/* 1 — Outcome: reality gets a voice */}
        <div className="card p-5">
          <p className="mb-3 text-sm font-medium text-ink">📈 How did this turn out?</p>
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.key}
                onClick={() => save({ outcome: r.outcome === o.key ? null : o.key })}
                aria-pressed={r.outcome === o.key}
                className={pill(r.outcome === o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>
          {r.outcome && (
            <textarea
              defaultValue={r.outcomeNote ?? ""}
              onBlur={(e) => {
                if ((e.target.value.trim() || "") !== (r.outcomeNote ?? ""))
                  save({ outcomeNote: e.target.value });
              }}
              placeholder="What actually happened? (optional)"
              className="input mt-3 min-h-[64px] w-full text-sm"
              maxLength={2000}
            />
          )}
        </div>

        {/* 2 — Biggest lesson: where wisdom compounds */}
        <div className="card p-5">
          <p className="mb-1 text-sm font-medium text-ink">💡 The biggest lesson</p>
          <p className="mb-3 text-xs text-ink-soft">
            One line you&apos;d tell yourself before the next decision like this.
          </p>
          <textarea
            defaultValue={r.lesson ?? ""}
            onBlur={(e) => {
              if ((e.target.value.trim() || "") !== (r.lesson ?? "")) save({ lesson: e.target.value });
            }}
            placeholder="e.g. Talk to customers earlier · Don't optimize for price alone · Ask one more expert"
            className="input min-h-[64px] w-full text-sm"
            maxLength={2000}
          />
        </div>

        {/* 3 — Same again today: watch your judgement evolve */}
        <div className="card p-5">
          <p className="mb-3 text-sm font-medium text-ink">
            🔄 Knowing what you know today, would you decide the same again?
          </p>
          <div className="flex flex-wrap gap-2">
            {SAME_AGAIN.map((s) => (
              <button
                key={s.key}
                onClick={() => save({ sameAgain: r.sameAgain === s.key ? null : s.key })}
                aria-pressed={r.sameAgain === s.key}
                className={pill(r.sameAgain === s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
          {r.sameAgain && (
            <textarea
              defaultValue={r.changed ?? ""}
              onBlur={(e) => {
                if ((e.target.value.trim() || "") !== (r.changed ?? ""))
                  save({ changed: e.target.value });
              }}
              placeholder="What changed? (optional)"
              className="input mt-3 min-h-[64px] w-full text-sm"
              maxLength={2000}
            />
          )}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-ink-soft">
        {savedAt ? "✓ Saved · " : ""}
        {r.updatedAt
          ? `You last looked back on ${new Date(r.updatedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}`
          : "Private to you — a note for your future self"}
      </p>
    </section>
  );
}
