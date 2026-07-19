"use client";

import { useState } from "react";
import Link from "next/link";

// The "?" in the nav → a calm walkthrough of how ThinkThru works. One idea per
// screen, plain words, Back/Next. Available everywhere so anyone can re-learn
// the flow any time (the app packs a lot — this makes it legible).

const STEPS: { emoji: string; title: string; body: string }[] = [
  {
    emoji: "🌱",
    title: "Start with a question",
    body: "Plant a seed — one real thing you want to figure out. Big (which school?) or small (where do we eat?).",
  },
  {
    emoji: "👨‍👩‍👧",
    title: "Bring your people",
    body: "Invite the folks who should decide it with you. Tag @claude or @chatgpt any time for a thoughtful take.",
  },
  {
    emoji: "💬",
    title: "Think it through",
    body: "Talk it out together in Discuss. React to what lands, endorse the good points, let the idea take shape.",
  },
  {
    emoji: "⚖️",
    title: "Decide together",
    body: "When you're ready, head to Decide — everyone gives their honest read, and it adds up to one fair answer.",
  },
  {
    emoji: "🌸",
    title: "It blooms",
    body: "The decision becomes a Bloom — a permanent record of what you chose and why, kept in your Sacred Tree.",
  },
  {
    emoji: "🪞",
    title: "Look back, get sharper",
    body: "Later, note how it turned out — and ask the people it affected how it landed. Your judgment grows over years.",
  },
];

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  function close() {
    setOpen(false);
    setStep(0);
  }

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="How ThinkThru works"
        title="How ThinkThru works"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(76,175,80,0.25)] font-serif text-base text-ink-soft transition hover:border-[rgba(76,175,80,0.5)] hover:text-ink"
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={close} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="How ThinkThru works"
            className="relative z-10 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-[rgba(76,175,80,0.3)] bg-[#0B120B] p-6 text-center shadow-xl"
          >
            <button
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 text-ink-soft transition hover:text-ink"
            >
              ✕
            </button>

            {/* progress dots */}
            <div className="mb-5 flex items-center justify-center gap-2">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === step ? 22 : 7,
                    background: i <= step ? "#66BB6A" : "rgba(255,255,255,0.14)",
                  }}
                />
              ))}
            </div>

            <div key={step} className="animate-[reflectStepIn_0.3s_ease-out]">
              <div className="mb-2 text-4xl">{s.emoji}</div>
              <h3 className="serif-lg mb-2">{s.title}</h3>
              <p className="mx-auto max-w-xs text-sm leading-relaxed text-ink-mid">{s.body}</p>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={() => setStep((n) => Math.max(0, n - 1))}
                disabled={step === 0}
                className="btn-ghost px-4 py-2 text-sm disabled:opacity-30"
              >
                ← Back
              </button>
              <span className="text-xs text-ink-soft">
                {step + 1} / {STEPS.length}
              </span>
              {last ? (
                <button onClick={close} className="btn-primary px-5 text-sm">
                  Got it 🌱
                </button>
              ) : (
                <button onClick={() => setStep((n) => n + 1)} className="btn-primary px-5 text-sm">
                  Next →
                </button>
              )}
            </div>

            {last && (
              <Link href="/about" onClick={close} className="mt-3 inline-block text-xs text-accent underline">
                More about ThinkThru
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
