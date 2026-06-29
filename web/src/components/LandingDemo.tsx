"use client";

import { useEffect, useState } from "react";
import { DIMENSIONS } from "@/lib/constants";

type Msg = { who: string; ai?: boolean; dim: string; text: string };
type Scenario = { q: string; msgs: Msg[]; bloom: string };

// A looping, self-explaining demo: a real question, a few labeled messages, then
// it Blooms — cycling through relatable decisions so a visitor sees their own
// use case and understands ThinkThru in seconds. No sign-in needed.
const SCENARIOS: Scenario[] = [
  {
    q: "Which school should we choose for Aria?",
    msgs: [
      { who: "Priya", dim: "foundations", text: "What matters most — academics, values, or distance?" },
      { who: "Arjun", dim: "debate", text: "The nearest one is easy, but its approach feels too rigid." },
      { who: "Claude", ai: true, dim: "understanding", text: "Teaching style and values shape a child more than a short commute." },
    ],
    bloom: "Lead with teaching philosophy and values; treat commute as a tie-breaker.",
  },
  {
    q: "Should we make this hire?",
    msgs: [
      { who: "Sam", dim: "application", text: "Strong skills, shipped real things — exactly our gap." },
      { who: "Mei", dim: "debate", text: "But the culture fit felt off in two interviews." },
      { who: "Claude", ai: true, dim: "understanding", text: "Skills can be coached; values misalignment rarely fixes itself." },
    ],
    bloom: "Pass — skills fit, but repeated culture-fit concerns outweigh them.",
  },
  {
    q: "Where should we travel this summer?",
    msgs: [
      { who: "Dad", dim: "foundations", text: "Is this trip about rest, adventure, or family time?" },
      { who: "Aria", dim: "application", text: "Somewhere with mountains AND a beach!" },
      { who: "Claude", ai: true, dim: "understanding", text: "A coast-plus-hills spot balances rest and adventure for every age." },
    ],
    bloom: "A coastal town near hills — rest for parents, adventure for kids.",
  },
];

function dimMeta(key: string) {
  return DIMENSIONS.find((d) => d.key === key) ?? DIMENSIONS[1];
}

export function LandingDemo() {
  const [si, setSi] = useState(0);
  const [step, setStep] = useState(0);
  const sc = SCENARIOS[si];
  const maxStep = sc.msgs.length + 3; // reveal msgs, bloom, then hold

  useEffect(() => {
    const t = setTimeout(
      () => {
        if (step + 1 >= maxStep) {
          setSi((x) => (x + 1) % SCENARIOS.length);
          setStep(0);
        } else {
          setStep(step + 1);
        }
      },
      step === 0 ? 1300 : 1600,
    );
    return () => clearTimeout(t);
  }, [si, step, maxStep]);

  const showBloom = step >= sc.msgs.length;

  // The whole conversation + bloom are ALWAYS in the DOM and reveal by fading in
  // (opacity), never by mounting — so the card's height never changes and the
  // page below it doesn't jump on mobile. Reserved min-heights keep the card the
  // same size across scenarios too.
  return (
    <div className="card mx-auto w-full max-w-sm p-4">
      {/* Seed question (rotating) */}
      <p className="eyebrow mb-1">🌱 Seed</p>
      <p key={sc.q} className="serif-lg mb-4 min-h-[3.25rem] animate-[fadeUp_0.5s_ease-out]">
        {sc.q}
      </p>

      {/* Conversation — all messages rendered; opacity reveals them in turn */}
      <div className="min-h-[176px] space-y-2">
        {sc.msgs.map((m, i) => {
          const d = dimMeta(m.dim);
          const revealed = i <= step;
          return (
            <div
              key={`${si}-${i}`}
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

      {/* Bloom — always rendered (reserves its space); fades in at the end */}
      <div
        className={`mt-3 rounded-xl border p-3 transition-opacity duration-500 ${showBloom ? "opacity-100" : "opacity-0"}`}
        style={{ borderColor: "rgba(255,179,0,0.4)", background: "rgba(255,179,0,0.08)" }}
      >
        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-bloom">
          🌸 Bloomed
        </p>
        <p className="text-xs leading-relaxed text-ink">{sc.bloom}</p>
      </div>
    </div>
  );
}
