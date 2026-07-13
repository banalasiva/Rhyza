"use client";

import { useEffect, useRef, useState } from "react";
import { DIMENSIONS } from "@/lib/constants";

type Msg = { who: string; ai?: boolean; dim: string; text: string };

// A looping storyboard built around ONE relatable decision — a family holiday —
// that mirrors the REAL app: in Discuss, Claude auto-tags every point by
// dimension (as it does in a live seed); in Decide, the group answers the same
// six questions the real Quorum asks, turning one big argument into six small
// ones; then it Blooms into a durable answer, kept in the Sacred Tree. It plays
// itself — the only controls are back / play / replay / next.
const TRIP = {
  q: "Where should we go for our holiday?",
  msgs: [
    { who: "Meera", dim: "foundations", text: "Somewhere the kids can run wild, or somewhere we can actually rest?" },
    { who: "Aarav", dim: "application", text: "Adventure! Can we do Thailand? 🏝️" },
    { who: "Priya", dim: "debate", text: "Thailand’s a stretch on the budget this year, though." },
    { who: "Ravi", dim: "debate", text: "Manali’s cheaper — but it’s a long drive with the parents." },
    { who: "Aarav", dim: "understanding", text: "@Claude which is better value in December — Goa or Thailand?" },
    { who: "Claude", ai: true, dim: "understanding", text: "Goa, for December — Thailand’s peak spikes flights. Calm beaches for you, water-sports for the kids, and it’s easy on everyone’s leave." },
  ] as Msg[],
  // Decide: the real Quorum's six questions. Answering them one at a time is the
  // whole trick — it turns "where should we go?!" into six small, fair calls.
  decideIntro: "Six small questions instead of one big argument:",
  questions: [
    { emoji: "💰", q: "Who’s spending the most?", a: "Ravi" },
    { emoji: "⏳", q: "Who’ll do the planning?", a: "Meera" },
    { emoji: "❤️", q: "Who cares the most?", a: "the kids" },
    { emoji: "🧭", q: "Whose judgement do we trust?", a: "Priya" },
    { emoji: "🛠", q: "Who can book it well?", a: "Ravi" },
    { emoji: "⚖️", q: "Who will it affect most?", a: "the kids" },
  ],
  result: "Goa — 64%",
  bloom: "Goa — beaches to unwind, water-sports for the kids, and it fits the budget and everyone’s leave.",
  treeSummary: "Goa: adventure and rest in one, within budget — and why we chose it, kept for next time.",
};

const STEPS = [
  { key: "think", emoji: "💬", label: "Discuss" },
  { key: "decide", emoji: "⚖️", label: "Decide" },
  { key: "bloom", emoji: "🌸", label: "Bloom" },
] as const;

// Phase boundaries derived from the message count. Steps 0..N-1 reveal the
// conversation one line at a time; then Decide (long, so all six questions get
// answered), Bloom, and two Sacred-Tree holds. Paced slow — time to read.
const N = TRIP.msgs.length;
const DECIDE_STEP = N;
const BLOOM_STEP = N + 1;
const DELAYS = [
  ...TRIP.msgs.map((m) => (m.ai ? 4200 : 2900)),
  8500, // Decide — long enough to answer all six questions
  5200, // Bloom
  6000, // Tree
  3000, // Tree hold
];

function dimMeta(key: string) {
  return DIMENSIONS.find((d) => d.key === key) ?? DIMENSIONS[1];
}

export function LandingDemo() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [decideIdx, setDecideIdx] = useState(0); // how many of the six answered
  const cardRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const startedRef = useRef(false);

  // Start cleanly from Meera's first line the moment it scrolls into view — never
  // greet someone mid-way at the Sacred Tree. Pause while off-screen.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          setStep(0);
          setPaused(false);
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const phase =
    step < DECIDE_STEP ? "think" : step === DECIDE_STEP ? "decide" : step === BLOOM_STEP ? "bloom" : "tree";
  const phaseIndex = phase === "think" ? 0 : phase === "decide" ? 1 : 2;

  // Main phase clock.
  useEffect(() => {
    if (paused || !inView) return;
    const t = setTimeout(() => setStep((s) => (s + 1 >= DELAYS.length ? 0 : s + 1)), DELAYS[step]);
    return () => clearTimeout(t);
  }, [step, paused, inView]);

  // Sub-clock: while Decide is on screen, answer the six questions one by one so
  // you can see the framework doing the work — not just a bare percentage.
  useEffect(() => {
    if (phase !== "decide") {
      setDecideIdx(0);
      return;
    }
    if (paused || !inView || decideIdx >= TRIP.questions.length) return;
    const t = setTimeout(() => setDecideIdx((i) => i + 1), 1050);
    return () => clearTimeout(t);
  }, [phase, decideIdx, paused, inView]);

  const go = (dir: -1 | 1) => {
    setPaused(true);
    setStep((s) => (s + dir + DELAYS.length) % DELAYS.length);
  };
  const replay = () => {
    setStep(0);
    setPaused(false);
  };
  const atEnd = step >= DELAYS.length - 1;
  const allAnswered = decideIdx >= TRIP.questions.length;

  return (
    <div ref={cardRef} className="card mx-auto w-full max-w-sm p-4">
      {/* Discuss · Decide · Bloom — lights up as it plays */}
      <div className="mb-4 flex items-center justify-center gap-1">
        {STEPS.map((s, i) => {
          const active = i === phaseIndex;
          const doneStep = i < phaseIndex;
          return (
            <div key={s.key} className="flex items-center gap-1">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all duration-500"
                style={{
                  background: active ? "rgba(76,175,80,0.18)" : "transparent",
                  color: active ? "#66BB6A" : doneStep ? "#4C7A4E" : "#5A6456",
                }}
              >
                <span aria-hidden>{s.emoji}</span>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <span aria-hidden className="text-[9px]" style={{ color: i < phaseIndex ? "#4C7A4E" : "#3A4238" }}>
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Seed question — the constant thread through every stage */}
      <p className="eyebrow mb-1">🌱 Seed</p>
      <p className="serif-lg mb-3 min-h-[3.25rem]">{TRIP.q}</p>

      {/* Stage — phases cross-fade in a fixed-height frame so the card is steady */}
      <div className="relative min-h-[340px]">
        {/* ── DISCUSS ── real app view: Claude auto-tags each point by dimension */}
        <div className={`absolute inset-0 overflow-y-auto transition-opacity duration-700 ${phase === "think" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <div className="space-y-2.5">
            {TRIP.msgs.map((m, i) => {
              const d = dimMeta(m.dim);
              const revealed = phase !== "think" || i <= step;
              return (
                <div key={i} className={`flex items-start gap-2 transition-opacity duration-500 ${revealed ? "opacity-100" : "opacity-0"}`}>
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
                    style={{ background: m.ai ? "rgba(76,175,80,0.2)" : "rgba(255,255,255,0.08)", color: m.ai ? "#66BB6A" : "#C8C4BC" }}
                  >
                    {m.ai ? "✦" : m.who[0]}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-ink">{m.who}</span>
                      {/* Claude's auto-tag — exactly as it appears in the app */}
                      <span className="rounded-full px-1.5 py-0.5 text-[9px]" style={{ color: d.color, background: `${d.color}1A` }}>
                        {d.emoji} {d.label}
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 rounded-xl px-2.5 py-1.5 text-xs leading-relaxed ${m.ai ? "text-ink" : "text-ink-mid"}`}
                      style={{ background: m.ai ? "rgba(76,175,80,0.1)" : "rgba(255,255,255,0.04)" }}
                    >
                      {m.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── DECIDE ── the six questions, answered one at a time (the framework) */}
        <div className={`absolute inset-0 transition-opacity duration-700 ${phase === "decide" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <p className="mb-2.5 text-[11px] leading-relaxed text-ink-soft">{TRIP.decideIntro}</p>
          <ul className="space-y-1.5">
            {TRIP.questions.map((qq, i) => {
              const answered = phase !== "decide" || i < decideIdx;
              return (
                <li
                  key={qq.q}
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition-all duration-300"
                  style={{ background: answered ? "rgba(76,175,80,0.07)" : "rgba(255,255,255,0.02)", opacity: answered ? 1 : 0.45 }}
                >
                  <span className="flex items-center gap-1.5 text-ink-mid">
                    <span aria-hidden>{qq.emoji}</span> {qq.q}
                  </span>
                  {answered ? (
                    <span className="shrink-0 rounded-full bg-[rgba(76,175,80,0.16)] px-2 py-0.5 text-[11px] font-medium text-accent">
                      {qq.a}
                    </span>
                  ) : (
                    <span className="shrink-0 text-ink-soft">·</span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className={`mt-3 text-center transition-opacity duration-500 ${allAnswered ? "opacity-100" : "opacity-0"}`}>
            <p className="text-[11px] text-ink-soft">
              Weighed together → <span className="font-medium text-bloom">{TRIP.result}</span>. Ready to bloom.
            </p>
          </div>
        </div>

        {/* ── BLOOM & SACRED TREE ── the payoff blossoms on its own */}
        <div className={`absolute inset-0 flex flex-col items-center transition-opacity duration-700 ${phase === "bloom" || phase === "tree" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <div className="relative h-[188px] w-full shrink-0 overflow-hidden rounded-xl bg-black">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "url('/sacred-tree-dark.png')",
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
            <div
              className="absolute left-1/2 top-2 -translate-x-1/2 animate-pulse text-3xl leading-none"
              style={{ filter: "drop-shadow(0 0 12px rgba(255,213,79,0.85))" }}
              aria-hidden
            >
              🌸
            </div>
          </div>
          <div className="relative mt-1 w-full flex-1">
            <div className={`absolute inset-0 text-center transition-opacity duration-500 ${phase === "bloom" ? "opacity-100" : "opacity-0"}`}>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-bloom">🌸 Bloomed</p>
              <div className="mx-auto max-w-[19rem] rounded-xl border p-3" style={{ borderColor: "rgba(255,179,0,0.4)", background: "rgba(255,179,0,0.08)" }}>
                <p className="text-xs leading-relaxed text-ink">{TRIP.bloom}</p>
              </div>
            </div>
            <div className={`absolute inset-0 transition-opacity duration-500 ${phase === "tree" ? "opacity-100" : "opacity-0"}`}>
              <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide" style={{ color: "#66BB6A" }}>
                🌳 Kept in your Sacred Tree
              </p>
              <div className="mx-auto max-w-[19rem] rounded-xl border p-3 text-left" style={{ borderColor: "rgba(76,175,80,0.3)", background: "rgba(76,175,80,0.06)" }}>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink">🌸 Where should we holiday?</p>
                <p className="text-[11px] leading-relaxed text-ink-mid">{TRIP.treeSummary}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls: the ONLY things you tap — back · play/replay/pause · next ── */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[rgba(255,255,255,0.06)] pt-3">
        <button
          onClick={() => go(-1)}
          aria-label="Previous"
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-ink-mid transition hover:bg-[rgba(255,255,255,0.05)] hover:text-ink"
        >
          ‹ Back
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {DELAYS.map((_, i) => (
              <button
                key={i}
                aria-label={`Step ${i + 1}`}
                onClick={() => {
                  setPaused(true);
                  setStep(i);
                }}
                className="h-1.5 rounded-full transition-all"
                style={{ width: i === step ? 14 : 6, background: i === step ? "#66BB6A" : "rgba(255,255,255,0.18)" }}
              />
            ))}
          </div>
          {paused || atEnd ? (
            <button
              onClick={atEnd ? replay : () => setPaused(false)}
              aria-label={atEnd ? "Play from start" : "Play"}
              className="rounded-full px-1.5 py-0.5 text-xs text-accent transition hover:text-ink"
            >
              {atEnd ? "↺ Replay" : "▶"}
            </button>
          ) : (
            <button
              onClick={() => setPaused(true)}
              aria-label="Pause"
              className="rounded-full px-1.5 py-0.5 text-xs text-ink-soft transition hover:text-ink"
            >
              ❚❚
            </button>
          )}
        </div>

        <button
          onClick={() => go(1)}
          aria-label="Next"
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-ink-mid transition hover:bg-[rgba(255,255,255,0.05)] hover:text-ink"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
