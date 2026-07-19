"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatedEmoji } from "@/components/AnimatedEmoji";

// Noto Animated Emoji codepoints for the three section icons — the same rich 3D
// set as reactions, and on-theme with the garden metaphor (all confirmed to HAVE
// a Noto animation, unlike the flat 📈 / 🔄). They read as a little garden arc:
//   🍎 the fruit the decision bore · 💡 the lesson · 🌱 would you plant it again?
const ICON = {
  outcome: { emoji: "🍎", code: "1f34e" },
  lesson: { emoji: "💡", code: "1f4a1" },
  sameAgain: { emoji: "🌱", code: "1f331" },
};

// Bloom 2.0 — a quiet conversation with your future self. NOT a wall of forms:
// one gentle question at a time, each with room to breathe and a short note on
// why it matters. A small bloom celebrates the reflection; then it settles into
// a calm summary you can revisit for years. Each section is private by default,
// shareable per section (the audience is whoever can open the bloom, which the
// seed's own visibility already defines — so there's no separate audience to pick).

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

const OUTCOMES = [
  { key: "better", label: "Better than expected" },
  { key: "expected", label: "About as expected" },
  { key: "worse", label: "Worse than expected" },
];
const SAME_AGAIN = [
  { key: "definitely_yes", label: "Definitely yes" },
  { key: "probably_yes", label: "Probably yes" },
  { key: "not_sure", label: "Not sure" },
  { key: "probably_no", label: "Probably no" },
  { key: "definitely_no", label: "Definitely no" },
];
const outcomeLabel = (k: string | null) => OUTCOMES.find((o) => o.key === k)?.label ?? null;
const sameAgainLabel = (k: string | null) => SAME_AGAIN.find((s) => s.key === k)?.label ?? null;

// Fixed sparkle directions for the celebration (no Math.random → no surprises).
const SPARKS = [
  { dx: "-64px", dy: "-30px", e: "✨" },
  { dx: "60px", dy: "-34px", e: "🌸" },
  { dx: "-40px", dy: "36px", e: "🌱" },
  { dx: "48px", dy: "34px", e: "✨" },
  { dx: "0px", dy: "-64px", e: "🌸" },
  { dx: "-72px", dy: "6px", e: "🌱" },
  { dx: "72px", dy: "2px", e: "✨" },
];

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
  const savingRef = useRef(false);

  const answered = useMemo(
    () => !!(r.outcome || (r.lesson && r.lesson.trim()) || r.sameAgain),
    [r.outcome, r.lesson, r.sameAgain],
  );
  const [mode, setMode] = useState<"wizard" | "summary">(answered ? "summary" : "wizard");
  const [step, setStep] = useState(0);
  const [celebrating, setCelebrating] = useState(false);

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
      }
    } catch {
      /* best-effort */
    } finally {
      savingRef.current = false;
    }
  }

  function finish() {
    setCelebrating(true);
    setTimeout(() => {
      setCelebrating(false);
      setMode("summary");
    }, 1700);
  }

  const pill = (active: boolean) =>
    `rounded-full border px-4 py-2.5 text-sm transition active:scale-95 ${
      active
        ? "border-bloom bg-[rgba(255,179,0,0.14)] text-bloom shadow-[0_0_16px_rgba(255,179,0,0.18)]"
        : "border-[rgba(255,255,255,0.14)] text-ink-mid hover:border-[rgba(255,179,0,0.4)] hover:text-ink"
    }`;

  const shareToggle = (isShared: boolean, onToggle: () => void) => (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={isShared}
      title={isShared ? `Shared — ${audience} can see this` : "Only you can see this"}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] transition ${
        isShared
          ? "border-accent bg-[rgba(76,175,80,0.1)] text-accent"
          : "border-[rgba(255,255,255,0.14)] text-ink-soft hover:text-ink"
      }`}
    >
      {isShared ? `👁 ${audience}` : "🔒 Only me"}
    </button>
  );

  // ── The three steps (title + why-it-matters description + body) ──
  const steps = [
    {
      emoji: ICON.outcome.emoji,
      code: ICON.outcome.code,
      title: "How did this turn out?",
      desc: "Reality gets a voice. Comparing what actually happened with what you expected is how judgment sharpens over time.",
      shared: r.outcomeShared,
      toggle: () => save({ outcomeShared: !r.outcomeShared }),
      body: (
        <>
          <div className="flex flex-col gap-2">
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
              className="input mt-3 min-h-[120px] w-full text-[15px] leading-relaxed"
              maxLength={2000}
            />
          )}
        </>
      ),
    },
    {
      emoji: ICON.lesson.emoji,
      code: ICON.lesson.code,
      title: "The biggest lesson",
      desc: "The one line worth carrying forward. This is where wisdom compounds — decision by decision, it becomes the pattern of how you think.",
      shared: r.lessonShared,
      toggle: () => save({ lessonShared: !r.lessonShared }),
      body: (
        <textarea
          defaultValue={r.lesson ?? ""}
          onBlur={(e) => {
            if ((e.target.value.trim() || "") !== (r.lesson ?? "")) save({ lesson: e.target.value });
          }}
          placeholder="e.g. Talk to customers earlier · Don't optimize for price alone · Ask one more expert"
          className="input min-h-[180px] w-full text-[15px] leading-relaxed"
          maxLength={2000}
          autoFocus
        />
      ),
    },
    {
      emoji: ICON.sameAgain.emoji,
      code: ICON.sameAgain.code,
      title: "Would you decide the same today?",
      desc: "Come back to this over the years. Watching your answer change is one of the clearest ways to see your own thinking evolve.",
      shared: r.sameAgainShared,
      toggle: () => save({ sameAgainShared: !r.sameAgainShared }),
      body: (
        <>
          <div className="flex flex-col gap-2">
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
              className="input mt-3 min-h-[120px] w-full text-[15px] leading-relaxed"
              maxLength={2000}
            />
          )}
        </>
      ),
    },
  ];

  // ── WIZARD ──────────────────────────────────────────────────────
  if (mode === "wizard") {
    const s = steps[step];
    return (
      <section className="mt-8">
        <div className="mb-4 text-center">
          <p className="eyebrow" style={{ color: "#FFB300" }}>
            🌱 Looking back
          </p>
        </div>

        <div className="relative mx-auto max-w-lg overflow-hidden rounded-2xl border border-[rgba(255,179,0,0.22)] bg-[rgba(255,179,0,0.04)] p-6 sm:p-8">
          {/* progress dots */}
          <div className="mb-6 flex items-center justify-center gap-2">
            {steps.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === step ? 26 : 8,
                  background: i <= step ? "#FFB300" : "rgba(255,255,255,0.14)",
                }}
              />
            ))}
          </div>

          {/* the one question */}
          <div key={step} className="animate-[reflectStepIn_0.35s_ease-out] text-center">
            <div className="mb-2 flex justify-center">
              <AnimatedEmoji codepoint={s.code} emoji={s.emoji} size={44} loop={false} />
            </div>
            <h3 className="serif-lg mb-2">{s.title}</h3>
            <p className="mx-auto mb-5 max-w-sm text-sm leading-relaxed text-ink-mid">{s.desc}</p>
            <div className="mx-auto max-w-sm text-left">{s.body}</div>
            <div className="mt-4 flex justify-center">{shareToggle(s.shared, s.toggle)}</div>
          </div>

          {/* nav */}
          <div className="mt-7 flex items-center justify-between gap-3">
            <button
              onClick={() => setStep((n) => Math.max(0, n - 1))}
              disabled={step === 0}
              className="btn-ghost px-4 py-2 text-sm disabled:opacity-30"
            >
              ← Back
            </button>
            <span className="text-xs text-ink-soft">
              {step + 1} of {steps.length} · no rush
            </span>
            {step < steps.length - 1 ? (
              <button onClick={() => setStep((n) => n + 1)} className="btn-primary px-5 text-sm">
                Next →
              </button>
            ) : (
              <button
                onClick={finish}
                className="rounded-full px-5 py-2 text-sm font-medium text-bg transition active:scale-95"
                style={{ background: "linear-gradient(135deg,#FFD54F,#FF8F00)" }}
              >
                Keep it 🌱
              </button>
            )}
          </div>

          {/* delightful finish */}
          {celebrating && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0B120B]/85 backdrop-blur-sm">
              <div className="relative">
                <div className="animate-[reflectPop_0.7s_ease-out] text-6xl">🌸</div>
                {SPARKS.map((sp, i) => (
                  <span
                    key={i}
                    className="absolute left-1/2 top-1/2 text-lg"
                    style={
                      {
                        "--dx": sp.dx,
                        "--dy": sp.dy,
                        animation: "reflectSpark 0.9s ease-out forwards",
                        animationDelay: "0.1s",
                      } as React.CSSProperties
                    }
                  >
                    {sp.e}
                  </span>
                ))}
              </div>
              <p className="serif-lg mt-4 animate-[fadeUp_0.5s_ease-out]">Kept 🌱</p>
              <p className="mt-1 animate-[fadeUp_0.6s_ease-out] text-xs text-ink-soft">
                A note for your future self
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  // ── SUMMARY (calm recap, revisitable) ───────────────────────────
  const rows = [
    {
      i: 0,
      ...ICON.outcome,
      label: "How it turned out",
      value: outcomeLabel(r.outcome),
      note: r.outcomeNote?.trim() || null,
      shared: r.outcomeShared,
    },
    { i: 1, ...ICON.lesson, label: "Biggest lesson", value: r.lesson?.trim() || null, note: null, shared: r.lessonShared },
    {
      i: 2,
      ...ICON.sameAgain,
      label: "Same again today?",
      value: sameAgainLabel(r.sameAgain),
      note: r.changed?.trim() || null,
      shared: r.sameAgainShared,
    },
  ];

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-end justify-between gap-2">
        <div>
          <p className="eyebrow" style={{ color: "#FFB300" }}>
            🌱 Looking back
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {r.updatedAt
              ? `You last looked back on ${new Date(r.updatedAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}`
              : "A note for your future self"}
          </p>
        </div>
        <button
          onClick={() => {
            setStep(0);
            setMode("wizard");
          }}
          className="btn-ghost no-print px-4 py-1.5 text-xs"
        >
          ✎ Revisit
        </button>
      </div>

      {/* One cohesive card — reads just like the bloom above it: a green
          heading per section, the answer in white. Tap any section to edit it. */}
      <article className="card p-6">
        {rows.map((row, idx) => (
          <button
            key={row.i}
            onClick={() => {
              setStep(row.i);
              setMode("wizard");
            }}
            className={`block w-full text-left transition ${
              idx > 0 ? "mt-5 border-t border-[rgba(255,255,255,0.06)] pt-5" : ""
            }`}
          >
            <span className="mb-1.5 flex items-center gap-2">
              {/* Plain glyph in the summary — guaranteed static, never fetches or
                  animates, so it can't "disappear". The wizard keeps the animated
                  Noto icons for the delightful step-through. */}
              <span aria-hidden className="text-lg leading-none">
                {row.emoji}
              </span>
              <span className="eyebrow">{row.label}</span>
              <span className={`text-[10px] ${row.shared ? "text-accent" : "text-ink-soft"}`}>
                {row.shared ? `👁 ${audience}` : "🔒 Only me"}
              </span>
            </span>
            <span className="block whitespace-pre-line text-[15px] leading-relaxed text-ink">
              {row.value || (!row.note && <span className="text-ink-soft">Tap to add — no rush</span>)}
            </span>
            {row.note && (
              <span className="mt-1 block whitespace-pre-line text-[15px] leading-relaxed text-ink-mid">
                {row.note}
              </span>
            )}
          </button>
        ))}
      </article>

      {/* What others chose to share — the loop closing on a shared decision. */}
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
                      <span className="text-ink-soft">📈 Turned out:</span> {outcomeLabel(s.outcome)}
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
