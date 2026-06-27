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
        <div className="mb-4 text-center">
          <div className="text-3xl">🌱</div>
          <h2 className="serif-lg mt-1">How a seed grows into knowledge</h2>
          <p className="mt-1 text-sm text-ink-mid">
            Rhyza turns a scattered conversation into one durable answer your
            group keeps forever.
          </p>
        </div>

        <Section emoji="🧭" title="Five dimensions = a well-rounded answer">
          <p className="mb-2">
            A question is explored through five lenses, so the answer isn&apos;t
            one-sided. Add your thoughts under whichever fits:
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

        <Section emoji="🪴" title="The plant shows the seed's life">
          <p>
            As people contribute and agree, the seed grows: <em>seed →
            germinating → sprouting → growing → bloomed</em>. The plant on the
            right is a live picture of where the conversation stands — vote with
            “Community feels” to move it.
          </p>
        </Section>

        <Section emoji="🌸" title="Blooming = the Aha moment">
          <p>
            When enough participants feel the answer is ready (just 2 people, or
            half the group), the seed <strong>blooms</strong>: Claude distills the
            whole discussion into one clear summary that lives in your{" "}
            <strong>Sacred Tree</strong> forever. That&apos;s the payoff —
            scattered chat becomes remembered knowledge.
          </p>
        </Section>

        <Section emoji="🤝" title="Claude is always here">
          <p>
            Tag <span className="text-accent">@claude</span> anytime to ask a
            question, or hit <strong>🕊️ Ask Claude to mediate</strong> if people
            disagree and you want a fair path forward.
          </p>
        </Section>

        <button onClick={onClose} className="btn-primary mt-2 w-full">
          Got it — let&apos;s grow something 🌿
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
