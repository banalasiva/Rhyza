"use client";

import { useEffect, useState } from "react";
import { DIMENSIONS } from "@/lib/constants";

type Msg = { who: string; ai?: boolean; dim: string; text: string };

// A looping, self-explaining storyboard built around ONE relatable decision —
// choosing a school — that walks a visitor through the whole ThinkThru arc as a
// smooth workflow: Think (talk it through), Decide (people vote, weighted by
// stake), Bloom (one durable answer), and where it's kept — the Sacred Tree.
// Phases cross-fade inside a fixed-height stage so the card never jumps.
const SCHOOL = {
  q: "Which school should we choose for Aria?",
  msgs: [
    { who: "Priya", dim: "foundations", text: "What matters most — academics, values, or distance?" },
    { who: "Aria", dim: "application", text: "When we visited, the art studio and the kids there felt right to me." },
    { who: "Arjun", dim: "debate", text: "The nearest school is easy, but its approach feels too rigid." },
    { who: "Claude", ai: true, dim: "understanding", text: "Teaching style and values shape a child more than a short commute." },
  ] as Msg[],
  // Decide: the weight spreads — each question is carried by whoever has the most
  // stake in it, so different people lead different questions.
  weighed: [
    { q: "Who will this affect the most?", a: "Aria" },
    { q: "Who’s paying for it?", a: "Arjun" },
    { q: "Whose judgement do we trust most?", a: "Priya" },
  ],
  voters: [
    { who: "Priya", voted: true },
    { who: "Arjun", voted: true },
    { who: "Aria", voted: false },
  ],
  pct: 62, // revealed weight behind "ready" — past the majority, it blooms
  bloom: "Lead with teaching philosophy and values; treat commute as a tie-breaker.",
  treeSummary: "Values & teaching style over commute — kept for your family, forever.",
};

const STEPS = [
  { key: "think", emoji: "💬", label: "Think" },
  { key: "decide", emoji: "⚖️", label: "Decide" },
  { key: "bloom", emoji: "🌸", label: "Bloom" },
] as const;

// step timeline: 0–3 reveal messages (Think) · 4 Decide · 5 Bloom · 6–7 Sacred
// Tree + hold, then loop.
const DELAYS = [1200, 1400, 1400, 1600, 2400, 2000, 2600, 1400];

function dimMeta(key: string) {
  return DIMENSIONS.find((d) => d.key === key) ?? DIMENSIONS[1];
}

export function LandingDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setStep((s) => (s + 1 >= DELAYS.length ? 0 : s + 1)), DELAYS[step]);
    return () => clearTimeout(t);
  }, [step]);

  const phase = step <= 3 ? "think" : step === 4 ? "decide" : step === 5 ? "bloom" : "tree";
  // The 3-step mantra: Bloom stays lit through the Sacred-Tree payoff.
  const phaseIndex = phase === "think" ? 0 : phase === "decide" ? 1 : 2;

  return (
    <div className="card mx-auto w-full max-w-sm p-4">
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
      <p className="serif-lg mb-3 min-h-[3.25rem]">{SCHOOL.q}</p>

      {/* Stage — phases cross-fade in a fixed-height frame so the card is steady */}
      <div className="relative min-h-[248px]">
        {/* ── THINK ── the conversation, each voice a different angle */}
        <div className={`absolute inset-0 transition-opacity duration-700 ${phase === "think" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <p className="mb-3 text-[11px] leading-relaxed text-ink-soft">
            Every voice adds a different angle — <span style={{ color: "#EC407A" }}>a question</span>,{" "}
            <span style={{ color: "#42A5F5" }}>real experience</span>,{" "}
            <span style={{ color: "#AB47BC" }}>a trade-off</span>,{" "}
            <span style={{ color: "#FFB300" }}>a clearer view</span>.
          </p>
          <div className="space-y-2">
            {SCHOOL.msgs.map((m, i) => {
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
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <span className="text-xs font-medium text-ink">{m.who}</span>
                      <span className="rounded-full px-1.5 py-0.5 text-[9px]" style={{ color: d.color, background: `${d.color}1A` }}>
                        {d.emoji} {d.label}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-ink-mid">{m.text}</p>
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
            {SCHOOL.weighed.map((d) => (
              <li key={d.q} className="text-xs leading-relaxed text-ink-mid">
                <span className="text-ink-soft">{d.q}</span> <span className="text-ink">→ {d.a}</span>
              </li>
            ))}
          </ul>
          {/* Voters cast their read */}
          <div className="mt-3 flex items-center gap-2">
            {SCHOOL.voters.map((v) => (
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
              style={{ width: phase === "decide" ? `${SCHOOL.pct}%` : "0%", background: "linear-gradient(to right,#FFD54F,#FF8F00)" }}
            />
            <span aria-hidden className="absolute -top-0.5 h-[10px] w-px bg-[rgba(255,255,255,0.45)]" style={{ left: "50%" }} />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
            Just 2 of 3 voted — but they carry <span className="text-ink">{SCHOOL.pct}%</span> of the weight. Past the majority, it blooms.
          </p>
        </div>

        {/* ── BLOOM ── one durable answer */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center text-center transition-opacity duration-700 ${phase === "bloom" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <div className="mb-2 text-4xl">🌸</div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-bloom">Bloomed</p>
          <div className="rounded-xl border p-3" style={{ borderColor: "rgba(255,179,0,0.4)", background: "rgba(255,179,0,0.08)" }}>
            <p className="text-xs leading-relaxed text-ink">{SCHOOL.bloom}</p>
          </div>
        </div>

        {/* ── SACRED TREE ── where the bloom is kept, with its summary */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center text-center transition-opacity duration-700 ${phase === "tree" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <div className="mb-2 text-4xl">🌳</div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: "#66BB6A" }}>
            Kept in your Sacred Tree
          </p>
          <div className="w-full rounded-xl border p-3 text-left" style={{ borderColor: "rgba(76,175,80,0.3)", background: "rgba(76,175,80,0.06)" }}>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink">
              🌸 Choosing Aria’s school
            </p>
            <p className="text-[11px] leading-relaxed text-ink-mid">{SCHOOL.treeSummary}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
