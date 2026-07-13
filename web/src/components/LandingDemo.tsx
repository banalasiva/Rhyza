"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { who: string; ai?: boolean; text: string };

// A looping, self-explaining storyboard built around ONE relatable decision —
// where to go on a family holiday. It shows the real dynamic: the group talks,
// someone asks Claude a question, Claude ANSWERS with something useful, and that
// helps everyone come together — then they Decide (weighted by who has the most
// at stake) and it Blooms into one answer they keep. Phases cross-fade in a
// fixed-height stage so it never jumps.
const TRIP = {
  q: "Where should we go for our holiday?",
  msgs: [
    { who: "Meera", text: "Somewhere the kids can run wild, or somewhere we can actually rest?" },
    { who: "Aarav", text: "Adventure! Can we do Thailand? 🏝️" },
    { who: "Priya", text: "Thailand’s a stretch on the budget this year, though." },
    { who: "Ravi", text: "Manali’s cheaper — but it’s a long drive with the parents." },
    { who: "Aarav", text: "@Claude which is better value in December — Goa or Thailand?" },
    { who: "Claude", ai: true, text: "Goa, for December — Thailand’s peak spikes flights. Calm beaches for you, water-sports for the kids, and it’s easy on everyone’s leave." },
  ] as Msg[],
  // Decide: not every voice weighs the same on every question — money, time,
  // experience. The person with the most at stake leads each one.
  weighed: [
    { q: "💰 Whose budget carries it?", a: "Ravi" },
    { q: "⏳ Who’s short on leave?", a: "Meera" },
    { q: "✨ Who’s it really for?", a: "the kids" },
  ],
  voters: [
    { who: "Meera", voted: true },
    { who: "Ravi", voted: true },
    { who: "Aarav", voted: false },
  ],
  pct: 64, // revealed weight behind "ready" — past the majority, it blooms
  bloom: "Goa — beaches to unwind, water-sports for the kids, and it fits the budget and everyone’s leave.",
  treeSummary: "Goa: adventure and rest in one, within budget — and why we chose it, kept for next time.",
};

const STEPS = [
  { key: "think", emoji: "💬", label: "Discuss" },
  { key: "decide", emoji: "⚖️", label: "Decide" },
  { key: "bloom", emoji: "🌸", label: "Bloom" },
] as const;

// Phase boundaries derived from the message count, so the discussion can be as
// long as it needs to be. Steps 0..N-1 reveal the conversation one line at a
// time, then Decide, Bloom, and two Sacred-Tree holds. Paced slow — give people
// time to actually read each line before the next arrives.
const N = TRIP.msgs.length;
const DECIDE_STEP = N;
const BLOOM_STEP = N + 1;
// A comfortable reading beat per message, longer for Claude's answer, then a
// generous hold on Decide and Bloom.
const DELAYS = [
  ...TRIP.msgs.map((m) => (m.ai ? 4200 : 2900)),
  7000, // Decide
  5200, // Bloom
  6000, // Tree
  3000, // Tree hold
];

export function LandingDemo() {
  const [step, setStep] = useState(0);
  // Auto-plays until the visitor touches it — then it's fully in their hands so
  // they can go back and sit on any moment (the "let me touch and go back" ask).
  const [paused, setPaused] = useState(false);
  // Don't run off-screen: start cleanly from the very first line (Meera) the
  // moment the card scrolls into view, so no one arrives to find it already at
  // the Sacred Tree.
  const cardRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const startedRef = useRef(false);

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

  useEffect(() => {
    if (paused || !inView) return;
    const t = setTimeout(() => setStep((s) => (s + 1 >= DELAYS.length ? 0 : s + 1)), DELAYS[step]);
    return () => clearTimeout(t);
  }, [step, paused, inView]);

  // Manual step — pauses auto-play and wraps around so it never dead-ends.
  const go = (dir: -1 | 1) => {
    setPaused(true);
    setStep((s) => (s + dir + DELAYS.length) % DELAYS.length);
  };

  // Play from the very start (Meera's first line), pressed or auto on entry.
  const replay = () => {
    setStep(0);
    setPaused(false);
  };
  const atEnd = step >= DELAYS.length - 1;

  const phase =
    step < DECIDE_STEP ? "think" : step === DECIDE_STEP ? "decide" : step === BLOOM_STEP ? "bloom" : "tree";
  // The 3-step mantra: Bloom stays lit through the Sacred-Tree payoff.
  const phaseIndex = phase === "think" ? 0 : phase === "decide" ? 1 : 2;

  return (
    <div ref={cardRef} className="card mx-auto w-full max-w-sm p-4">
      {/* Think · Decide · Bloom — the three steps, lighting up as it plays */}
      <div className="mb-4 flex items-center justify-center gap-1">
        {STEPS.map((s, i) => {
          const active = i === phaseIndex;
          const done = i < phaseIndex;
          return (
            <div key={s.key} className="flex items-center gap-1">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all duration-500"
                style={{
                  background: active ? "rgba(76,175,80,0.18)" : "transparent",
                  color: active ? "#66BB6A" : done ? "#4C7A4E" : "#5A6456",
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
        {/* ── THINK ── the group talks; someone asks Claude, Claude answers */}
        <div className={`absolute inset-0 overflow-y-auto transition-opacity duration-700 ${phase === "think" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <div className="space-y-2.5">
            {TRIP.msgs.map((m, i) => {
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
                    <span className="text-xs font-medium text-ink">{m.who === "Claude" ? "Claude · answering" : m.who}</span>
                    <p
                      className={`mt-0.5 rounded-xl px-2.5 py-1.5 text-xs leading-relaxed ${
                        m.ai ? "text-ink" : "text-ink-mid"
                      }`}
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

        {/* ── DECIDE ── people vote; weight is spread and revealed */}
        <div className={`absolute inset-0 transition-opacity duration-700 ${phase === "decide" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <p className="mb-2 text-[11px] leading-relaxed text-ink-soft">
            Everyone weighs in — and each question is carried by whoever has the most at stake.
          </p>
          <ul className="space-y-1">
            {TRIP.weighed.map((d) => (
              <li key={d.q} className="text-xs leading-relaxed text-ink-mid">
                <span className="text-ink-soft">{d.q}</span> <span className="text-ink">→ {d.a}</span>
              </li>
            ))}
          </ul>
          {/* Voters cast their read */}
          <div className="mt-3 flex items-center gap-2">
            {TRIP.voters.map((v) => (
              <span
                key={v.who}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px]"
                style={{
                  background: v.voted ? "rgba(76,175,80,0.14)" : "rgba(255,255,255,0.04)",
                  color: v.voted ? "#66BB6A" : "#5A6456",
                }}
              >
                {v.voted ? "✓" : "…"} {v.who}
              </span>
            ))}
          </div>
          {/* Weight revealed — a majority marker at 50%; the fill crosses it */}
          <div className="relative mt-3 h-1.5 rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="h-full rounded-full transition-[width] duration-1000"
              style={{ width: phase === "decide" ? `${TRIP.pct}%` : "0%", background: "linear-gradient(to right,#FFD54F,#FF8F00)" }}
            />
            <span aria-hidden className="absolute -top-0.5 h-[10px] w-px bg-[rgba(255,255,255,0.45)]" style={{ left: "50%" }} />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
            Just 2 of 3 voted — but they carry <span className="text-ink">{TRIP.pct}%</span> of the weight. Past the majority, it blooms.
          </p>
        </div>

        {/* ── BLOOM & SACRED TREE ── the joyful payoff: a bloom blossoming on the
            Sacred Tree (the real artwork), while the words move from "it bloomed"
            to "it's kept forever". */}
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
            {/* the bloom, blossoming in the canopy */}
            <div
              className="absolute left-1/2 top-2 -translate-x-1/2 animate-pulse text-3xl leading-none"
              style={{ filter: "drop-shadow(0 0 12px rgba(255,213,79,0.85))" }}
              aria-hidden
            >
              🌸
            </div>
          </div>
          {/* Caption swaps between Bloom and Tree in a small reserved area */}
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

      {/* ── Controls: tap to step back or forward, or play/pause ── */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[rgba(255,255,255,0.06)] pt-3">
        <button
          onClick={() => go(-1)}
          aria-label="Previous"
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-ink-mid transition hover:bg-[rgba(255,255,255,0.05)] hover:text-ink"
        >
          ‹ Back
        </button>

        <div className="flex items-center gap-2">
          {/* progress dots — tap any to jump there */}
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
                style={{
                  width: i === step ? 14 : 6,
                  background: i === step ? "#66BB6A" : "rgba(255,255,255,0.18)",
                }}
              />
            ))}
          </div>
          {/* Play from the start when it's over or paused at the end; otherwise
              a simple pause/resume. */}
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
