"use client";

import { useEffect, useState } from "react";
import { DIMENSIONS } from "@/lib/constants";

type Msg = { who: string; ai?: boolean; dim: string; text: string };

// A looping, self-explaining demo built around ONE relatable decision —
// choosing a school — walking a visitor through the three steps ThinkThru is
// built on: Think (talk it through), Decide (weigh in together), Bloom (a
// durable answer everyone keeps). No sign-in needed.
const SCHOOL = {
  q: "Which school should we choose for Aria?",
  msgs: [
    { who: "Priya", dim: "foundations", text: "What matters most — academics, values, or distance?" },
    { who: "Aria", dim: "application", text: "When we visited, the art studio and the kids there felt right to me." },
    { who: "Arjun", dim: "debate", text: "The nearest school is easy, but its approach feels too rigid." },
    { who: "Claude", ai: true, dim: "understanding", text: "Teaching style and values shape a child more than a short commute." },
  ] as Msg[],
  // Decide isn't a plain vote — the group answers real weighting questions (from
  // the "Decide" quorum template) so the fairest voice carries most on each part.
  decide: [
    { q: "Who will this affect the most?", a: "Aria" },
    { q: "Whose opinion do you trust most here?", a: "Priya & Arjun" },
  ],
  bloom: "Lead with teaching philosophy and values; treat commute as a tie-breaker.",
};

const STEPS = [
  { key: "think", emoji: "💬", label: "Think" },
  { key: "decide", emoji: "⚖️", label: "Decide" },
  { key: "bloom", emoji: "🌸", label: "Bloom" },
] as const;

function dimMeta(key: string) {
  return DIMENSIONS.find((d) => d.key === key) ?? DIMENSIONS[1];
}

export function LandingDemo() {
  const [step, setStep] = useState(0);
  const nMsgs = SCHOOL.msgs.length;
  // steps: reveal each message (Think), then Decide, then Bloom, then hold.
  const decideAt = nMsgs; // step index where "Decide" lands
  const bloomAt = nMsgs + 1; // step index where "Bloom" lands
  const maxStep = nMsgs + 4; // bloom + a short hold, then loop

  useEffect(() => {
    const t = setTimeout(
      () => setStep((s) => (s + 1 >= maxStep ? 0 : s + 1)),
      step === 0 ? 1300 : 1600,
    );
    return () => clearTimeout(t);
  }, [step, maxStep]);

  const phase = step < decideAt ? "think" : step < bloomAt ? "decide" : "bloom";
  const phaseIndex = STEPS.findIndex((s) => s.key === phase);
  const showDecide = step >= decideAt;
  const showBloom = step >= bloomAt;

  // Everything is ALWAYS in the DOM and reveals by fading in (opacity), never by
  // mounting — so the card's height never changes and the page below it doesn't
  // jump. Reserved min-heights keep the card steady across the loop.
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

      {/* Seed question */}
      <p className="eyebrow mb-1">🌱 Seed</p>
      <p className="serif-lg mb-2 min-h-[3.25rem]">{SCHOOL.q}</p>
      {/* What the coloured tags mean — the "parameters" that keep a discussion
          whole, in plain words (not the internal dimension blurbs). */}
      <p className="mb-4 text-[11px] leading-relaxed text-ink-soft">
        Every voice adds a different angle — <span style={{ color: "#EC407A" }}>a question</span>,{" "}
        <span style={{ color: "#42A5F5" }}>real experience</span>,{" "}
        <span style={{ color: "#AB47BC" }}>a trade-off</span>,{" "}
        <span style={{ color: "#FFB300" }}>a clearer view</span>. ThinkThru tags each so nothing gets lost.
      </p>

      {/* Think — the conversation; opacity reveals each message in turn */}
      <div className="min-h-[232px] space-y-2">
        {SCHOOL.msgs.map((m, i) => {
          const d = dimMeta(m.dim);
          const revealed = i <= step;
          return (
            <div
              key={i}
              className={`flex items-start gap-2 transition-opacity duration-500 ${revealed ? "opacity-100" : "opacity-0"}`}
            >
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
                style={{ background: m.ai ? "rgba(76,175,80,0.2)" : "rgba(255,255,255,0.08)", color: m.ai ? "#66BB6A" : "#C8C4BC" }}
              >
                {m.ai ? "✦" : m.who[0]}
              </span>
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className="text-xs font-medium text-ink">{m.who}</span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px]"
                    style={{ color: d.color, background: `${d.color}1A` }}
                  >
                    {d.emoji} {d.label}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-ink-mid">{m.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Decide — the group converges; fades in before the bloom */}
      <div
        className={`mt-3 flex items-start gap-2 rounded-xl border p-3 transition-opacity duration-500 ${showDecide ? "opacity-100" : "opacity-0"}`}
        style={{ borderColor: "rgba(76,175,80,0.3)", background: "rgba(76,175,80,0.06)" }}
      >
        <span aria-hidden className="text-sm leading-none">⚖️</span>
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-medium" style={{ color: "#66BB6A" }}>Decided together</p>
          <ul className="space-y-1">
            {SCHOOL.decide.map((d) => (
              <li key={d.q} className="text-xs leading-relaxed text-ink-mid">
                <span className="text-ink-soft">{d.q}</span>{" "}
                <span className="text-ink">→ {d.a}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
            Everyone&apos;s weight adds up to one fair answer — not just the loudest voice.
          </p>
        </div>
      </div>

      {/* Bloom — the durable answer everyone keeps */}
      <div
        className={`mt-3 rounded-xl border p-3 transition-opacity duration-500 ${showBloom ? "opacity-100" : "opacity-0"}`}
        style={{ borderColor: "rgba(255,179,0,0.4)", background: "rgba(255,179,0,0.08)" }}
      >
        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-bloom">🌸 Bloomed</p>
        <p className="text-xs leading-relaxed text-ink">{SCHOOL.bloom}</p>
      </div>
    </div>
  );
}
