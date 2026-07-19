"use client";

import { useRef, useState } from "react";

// Bloom 2.0 — a quiet conversation with your future self. Not a form: three
// gentle prompts you return to whenever reality has taught you something. Each
// answer autosaves on its own, and each section is PRIVATE by default — you can
// choose, per section, to share it. "Shared" simply means visible to whoever can
// open this bloom, which the seed's own visibility already defines (private seed
// → its members; public → public), so there's no separate audience to pick.

type Reflection = {
  outcome: string | null;
  outcomeNote: string | null;
  lesson: string | null;
  sameAgain: string | null;
  changed: string | null;
  outcomeShared: boolean;
  lessonShared: boolean;
  sameAgainShared: boolean;
  updatedAt: string | null;
};

type SharedReflection = {
  name: string;
  outcome: string | null;
  outcomeNote: string | null;
  lesson: string | null;
  sameAgain: string | null;
  changed: string | null;
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

const outcomeLabel = (k: string | null) => OUTCOMES.find((o) => o.key === k)?.label ?? null;
const sameAgainLabel = (k: string | null) => SAME_AGAIN.find((s) => s.key === k)?.label ?? null;

export function BloomReflection({
  bloomId,
  initial,
  seedPrivate,
  shared,
}: {
  bloomId: string;
  initial: Reflection;
  seedPrivate: boolean;
  shared: SharedReflection[];
}) {
  const [r, setR] = useState<Reflection>(initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const savingRef = useRef(false);

  // The audience "Shared" resolves to, purely for an honest label on the toggle.
  const audience = seedPrivate ? "Seed members" : "Public";

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

  // The little per-section privacy control. Private by default; one tap shares.
  const shareToggle = (isShared: boolean, onToggle: () => void) => (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={isShared}
      title={isShared ? `Shared — ${audience} can see this` : "Only you can see this"}
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition ${
        isShared
          ? "border-accent bg-[rgba(76,175,80,0.1)] text-accent"
          : "border-[rgba(255,255,255,0.14)] text-ink-soft hover:text-ink"
      }`}
    >
      {isShared ? `👁 ${audience}` : "🔒 Only me"}
    </button>
  );

  return (
    <section className="mt-8">
      <div className="mb-4 text-center">
        <p className="eyebrow mb-1" style={{ color: "#FFB300" }}>
          🌱 Looking back
        </p>
        <h2 className="serif-lg mb-1">What did reality teach you?</h2>
        <p className="mx-auto max-w-md text-sm text-ink-mid">
          A bloom keeps growing. Come back whenever life has an answer — no rush, nothing to submit.
          Each part is private until you choose to share it.
        </p>
      </div>

      <div className="space-y-3">
        {/* 1 — Outcome */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">📈 How did this turn out?</p>
            {shareToggle(r.outcomeShared, () => save({ outcomeShared: !r.outcomeShared }))}
          </div>
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

        {/* 2 — Biggest lesson */}
        <div className="card p-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">💡 The biggest lesson</p>
            {shareToggle(r.lessonShared, () => save({ lessonShared: !r.lessonShared }))}
          </div>
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

        {/* 3 — Same again today */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">
              🔄 Knowing what you know today, would you decide the same again?
            </p>
            {shareToggle(r.sameAgainShared, () => save({ sameAgainShared: !r.sameAgainShared }))}
          </div>
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
          : "Private to you until you choose to share a part"}
      </p>

      {/* What others chose to share — the loop closing on a decision made
          together. Only sections each person opted to share appear here. */}
      {shared.length > 0 && (
        <div className="mt-8">
          <p className="eyebrow mb-3 text-center">🌿 What others took from this</p>
          <div className="space-y-3">
            {shared.map((s, i) => (
              <div key={i} className="card p-4">
                <p className="mb-2 text-sm font-medium text-accent">{s.name}</p>
                <div className="space-y-1.5 text-sm text-ink-mid">
                  {outcomeLabel(s.outcome) && (
                    <p>
                      <span className="text-ink-soft">📈 Turned out:</span>{" "}
                      {outcomeLabel(s.outcome)}
                      {s.outcomeNote ? ` — ${s.outcomeNote}` : ""}
                    </p>
                  )}
                  {s.lesson && (
                    <p>
                      <span className="text-ink-soft">💡 Lesson:</span> {s.lesson}
                    </p>
                  )}
                  {sameAgainLabel(s.sameAgain) && (
                    <p>
                      <span className="text-ink-soft">🔄 Same again?</span>{" "}
                      {sameAgainLabel(s.sameAgain)}
                      {s.changed ? ` — ${s.changed}` : ""}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
