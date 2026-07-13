"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DIMENSIONS, QUORUM_DIMENSIONS } from "@/lib/constants";
import { PlantSvg } from "@/components/PlantSvg";

type Msg = { who: string; ai?: boolean; dim: string; text: string };

// Who the group ranks best-first for each of the SIX real Quorum questions.
const RANKS: Record<string, string[]> = {
  money: ["Ravi", "Priya", "Meera"],
  effort: ["Meera", "Priya", "Ravi"],
  emotions: ["Aarav", "Meera", "Priya"],
  judgement: ["Priya", "Ravi", "Meera"],
  capability: ["Ravi", "Meera", "Priya"],
  consequence: ["Aarav", "Meera", "Ravi"],
};
// The exact questions the app asks — pulled straight from QUORUM_DIMENSIONS so
// the demo and the product can never drift apart.
const WEIGH = QUORUM_DIMENSIONS.map((d) => ({
  emoji: d.emoji,
  label: d.label,
  q: d.question,
  ranked: RANKS[d.key] ?? [],
}));

// A deterministic radial petal burst for the bloom (no Math.random, so it never
// mismatches on hydration) — the same leaf-particle animation the app uses.
const BURST = Array.from({ length: 16 }).map((_, i) => {
  const rad = ((i / 16) * 360 * Math.PI) / 180;
  const dist = 90 + (i % 3) * 30;
  return {
    emoji: ["🌸", "🌼", "🌺", "🍃", "✨", "💛"][i % 6],
    bx: `${Math.round(Math.cos(rad) * dist)}%`,
    by: `${Math.round(Math.sin(rad) * dist)}%`,
    delay: (i % 8) * 0.05,
    size: 14 + (i % 4) * 4,
  };
});

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
  // Decide: the real weigh-in — the app's exact six questions (from WEIGH). You
  // rank the people best-first, then Next → Next → Next.
  weigh: WEIGH,
  // The reveal: how the weight settled — plus the quiet magic, the room seeing
  // you differently than you saw yourself.
  weights: [
    { who: "Ravi", pct: 31 },
    { who: "Meera", pct: 28 },
    { who: "Priya", pct: 23 },
    { who: "Aarav", pct: 18 },
  ],
  mirror: "Priya — the room trusts your judgement more than you did. You ranked yourself 3rd; they put you 1st. 🌱",
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
  34000, // Decide — six questions, the reveal, then the vote to bloom
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

  // Sub-clock: while Decide is on screen, step through the six weigh-in questions
  // (ranking people best-first), then the reveal, then the vote to bloom — the
  // real flow. decideIdx 0..5 = questions, 6 = reveal, 7 = proceed-to-bloom.
  const REVEAL_IDX = TRIP.weigh.length; // 6
  const PROCEED_IDX = TRIP.weigh.length + 1; // 7
  useEffect(() => {
    if (phase !== "decide") {
      setDecideIdx(0);
      return;
    }
    if (paused || !inView || decideIdx >= PROCEED_IDX) return;
    const t = setTimeout(() => setDecideIdx((i) => i + 1), 4200);
    return () => clearTimeout(t);
  }, [phase, decideIdx, paused, inView, PROCEED_IDX]);

  const go = (dir: -1 | 1) => {
    setPaused(true);
    setStep((s) => (s + dir + DELAYS.length) % DELAYS.length);
  };
  const replay = () => {
    setStep(0);
    setPaused(false);
  };
  const atEnd = step >= DELAYS.length - 1;
  const showReveal = decideIdx === REVEAL_IDX; // the weights + mirror
  const showProceed = decideIdx >= PROCEED_IDX; // vote to bloom
  const weighQ = TRIP.weigh[Math.min(decideIdx, TRIP.weigh.length - 1)];

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

        {/* ── DECIDE ── the real weigh-in: rank people per question, Next ×6,
            then the reveal (with the room seeing you differently than you did) */}
        <div className={`absolute inset-0 transition-opacity duration-700 ${phase === "decide" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          {showProceed ? (
            // ── Proceed to bloom: only the weighted voices vote; it needs >50% ──
            <div className="animate-[fadeUp_0.5s_ease-out]">
              <p className="mb-2.5 text-[11px] text-ink-soft">
                Now the ones carrying the weight vote to bloom — it needs more than half. 🌸
              </p>
              <div className="space-y-1.5">
                {TRIP.weights.map((w, i) => {
                  const voted = i < 3; // Ravi + Meera + Priya = 82%
                  return (
                    <div key={w.who} className="flex items-center gap-2 rounded-lg bg-[rgba(76,175,80,0.06)] px-2.5 py-1.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] text-[11px] font-medium text-ink-mid">
                        {w.who[0]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{w.who}</span>
                      <span className="text-[11px] text-ink-soft">{w.pct}%</span>
                      <span className={`w-4 text-center text-sm ${voted ? "text-accent" : "text-ink-soft"}`}>
                        {voted ? "✓" : "·"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="relative mt-3 h-2.5 rounded-full bg-[rgba(255,255,255,0.08)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: "82%", background: "linear-gradient(to right,#FFD54F,#FF8F00)", transition: "width 1.1s ease-out" }}
                />
                <span aria-hidden className="absolute -top-1 h-[18px] w-px bg-white/50" style={{ left: "50%" }} />
              </div>
              <p className="mt-2 text-center text-[11px] text-ink">
                <span className="font-medium text-bloom">82%</span> of the weight says bloom — past
                the halfway mark.
              </p>
              {/* The deliberate final step — so the flow lands, not jumps. */}
              <div className="mt-3 flex justify-center">
                <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-[linear-gradient(to_right,#FFD54F,#FF8F00)] px-5 py-2 text-sm font-semibold text-[#3a2600] shadow-[0_0_18px_rgba(255,179,0,0.4)]">
                  🌸 Bloom now
                </span>
              </div>
            </div>
          ) : !showReveal ? (
            <div key={decideIdx} className="animate-[fadeUp_0.4s_ease-out]">
              <p className="mb-2 text-[11px] text-ink-soft">Everyone weighs in privately — one question at a time.</p>
              {/* progress dots across the six questions */}
              <div className="mb-3 flex items-center justify-center gap-1.5">
                {TRIP.weigh.map((_, i) => (
                  <span
                    key={i}
                    className="h-1.5 rounded-full transition-all"
                    style={{ width: i === decideIdx ? 20 : 7, background: i < decideIdx ? "rgba(76,175,80,0.6)" : i === decideIdx ? "#66BB6A" : "rgba(255,255,255,0.15)" }}
                  />
                ))}
              </div>
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-lg">{weighQ.emoji}</span>
                <span className="text-[10px] uppercase tracking-wide text-ink-soft">
                  {weighQ.label} · {Math.min(decideIdx + 1, TRIP.weigh.length)} of {TRIP.weigh.length}
                </span>
              </div>
              <p className="serif-lg mb-2 text-lg">{weighQ.q}</p>
              {/* ranked best-first */}
              <ol className="space-y-1.5">
                {weighQ.ranked.map((who, i) => (
                  <li
                    key={who}
                    className="flex items-center gap-2 rounded-xl border border-[rgba(76,175,80,0.25)] bg-[rgba(76,175,80,0.06)] px-2 py-1.5"
                    style={{ animation: `fadeUp 0.35s ease-out ${i * 0.12}s both` }}
                  >
                    <span className="w-5 shrink-0 text-center text-sm font-semibold text-accent">{i + 1}</span>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] text-[11px] font-medium text-ink-mid">
                      {who[0]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{who}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-2.5 text-right">
                <span className="inline-block rounded-full bg-[rgba(76,175,80,0.14)] px-3 py-1 text-[11px] font-medium text-accent">
                  {decideIdx === TRIP.weigh.length - 1 ? "Done ✓" : "Next ›"}
                </span>
              </div>
            </div>
          ) : (
            <div className="animate-[fadeUp_0.5s_ease-out]">
              <p className="mb-2.5 text-[11px] text-ink-soft">The room’s read is in — here’s how the say settles:</p>
              <div className="space-y-2">
                {TRIP.weights.map((w) => (
                  <div key={w.who} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-xs text-ink-mid">{w.who}</span>
                    <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${w.pct}%`, background: "linear-gradient(to right,#66BB6A,#4CAF50)", transition: "width 0.9s ease-out" }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-xs font-semibold text-ink">{w.pct}%</span>
                  </div>
                ))}
              </div>
              {/* the quiet magic — the mirror */}
              <div className="mt-3 rounded-xl border border-[rgba(255,179,0,0.35)] bg-[rgba(255,179,0,0.07)] p-2.5">
                <p className="text-[11px] leading-relaxed text-ink-mid">{TRIP.mirror}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── BLOOM ── the celebration: the flower opens inside a ring of light */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-700 ${phase === "bloom" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <div className="relative flex h-[210px] w-full items-center justify-center overflow-hidden">
            {/* a gentle petal burst as it opens — no disk, just the plant */}
            {phase === "bloom" && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
                {BURST.map((p, i) => (
                  <span
                    key={i}
                    className="leaf-particle"
                    style={{ fontSize: p.size, animationDelay: `${p.delay}s`, ["--bx"]: p.bx, ["--by"]: p.by, ["--bx2"]: p.bx, ["--by2"]: p.by } as CSSProperties}
                  >
                    {p.emoji}
                  </span>
                ))}
              </div>
            )}
            {/* the real growing plant, fully bloomed */}
            <div
              className="relative h-36 w-36 drop-shadow-[0_0_22px_rgba(255,213,79,0.7)]"
              style={{ animation: "fadeUp 0.7s ease-out" }}
            >
              <PlantSvg stage={4} />
            </div>
          </div>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-bloom">🌸 It bloomed!</p>
          <div className="mx-auto mt-2 max-w-[19rem] rounded-xl border p-3 text-center" style={{ borderColor: "rgba(255,179,0,0.4)", background: "rgba(255,179,0,0.08)" }}>
            <p className="text-xs leading-relaxed text-ink">{TRIP.bloom}</p>
          </div>
        </div>

        {/* ── SACRED TREE ── where the bloom is kept, forever */}
        <div className={`absolute inset-0 flex flex-col items-center transition-opacity duration-700 ${phase === "tree" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
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
          <div className="mt-2 w-full">
            <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide" style={{ color: "#66BB6A" }}>
              🌳 Your bloom is on the Sacred Tree
            </p>
            <div className="mx-auto max-w-[19rem] rounded-xl border p-3 text-left" style={{ borderColor: "rgba(76,175,80,0.3)", background: "rgba(76,175,80,0.06)" }}>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink">🌸 Where should we holiday?</p>
              <p className="text-[11px] leading-relaxed text-ink-mid">{TRIP.treeSummary}</p>
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
