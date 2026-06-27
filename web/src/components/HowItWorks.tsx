"use client";

import { DIMENSIONS } from "@/lib/constants";

// A short explainer for first-time users: why dimensions exist, what the plant
// means, and how/why a seed blooms. Shown automatically on first visit and from
// the "How it works" button.
export function HowItWorks({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-[rgba(8,5,0,0.72)] px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card max-h-full w-full max-w-lg overflow-auto p-6 animate-[fadeUp_0.4s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 text-center">
          <div className="text-3xl">🌱</div>
          <h2 className="serif-lg mt-1">The best thinking happens together — and then it vanishes.</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-mid">
            The sharp insight scrolls away. The call goes to whoever spoke
            loudest. By Monday, what the group actually understood is gone.
            <br />
            <span className="mt-2 inline-block text-ink">
              Rhyza is a quiet rebellion against that. Plant a question, let many
              hands tend it, and when you truly converge it <strong>blooms</strong>{" "}
              into one answer your people keep — for good.
            </span>
          </p>
        </div>

        <Section emoji="🧭" title="No single mind sees the whole">
          <p className="mb-2">
            So a question is tended through five lenses — not one loud opinion.
            Add your part wherever you see clearly:
          </p>
          <ul className="space-y-1">
            {DIMENSIONS.map((d) => (
              <li key={d.key} className="flex gap-2">
                <span>{d.emoji}</span>
                <span>
                  <strong style={{ color: d.color }}>{d.label}</strong> — {d.blurb}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section emoji="🪴" title="Watch the thinking come alive">
          <p>
            You&apos;re not posting into a void — you&apos;re tending something
            living. The plant is the conversation&apos;s pulse, growing as people
            contribute and agree (<em>seed → germinating → sprouting → growing →
            bloomed</em>). Vote with “Community feels” to move it.
          </p>
        </Section>

        <Section emoji="🌸" title="Consensus you can hold">
          <p>
            When enough of you genuinely feel it&apos;s ready — just 2, or half
            the group — the seed <strong>blooms</strong>: Claude distills
            everything said into one clear answer that lives in your{" "}
            <strong>Sacred Tree</strong>. Knowledge <em>grown, not declared</em> —
            earned, not imposed. And when minds change, it grows a new version,
            the old one kept, so you can see how your thinking evolved.
          </p>
        </Section>

        <Section emoji="🤝" title="A mind always in the room">
          <p>
            Tag <span className="text-accent">@claude</span> to think with you, or
            hit <strong>🕊️ Ask Claude to mediate</strong> when you disagree — a
            fair voice with no side to take.
          </p>
        </Section>

        <p className="mb-4 text-center text-sm text-ink">
          Most tools help you <em>talk</em>. Rhyza helps you{" "}
          <strong className="text-accent">arrive</strong> — together, and for good.
        </p>

        <button onClick={onClose} className="btn-primary w-full">
          Let&apos;s grow something 🌿
        </button>
      </div>
    </div>
  );
}

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-xl border border-[rgba(76,175,80,0.15)] bg-[rgba(7,13,7,0.4)] p-3">
      <p className="mb-1 flex items-center gap-2 text-sm font-medium text-ink">
        <span className="text-base">{emoji}</span>
        {title}
      </p>
      <div className="text-sm leading-relaxed text-ink-mid">{children}</div>
    </div>
  );
}
