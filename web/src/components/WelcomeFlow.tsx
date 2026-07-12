"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/client";

// The first minute — a short CONVERSATION, not a pitch. It hooks with a question
// the newcomer is already asking, answers the one objection everyone has ("can't
// I just ask ChatGPT myself?"), shows the whole app is three simple steps, and
// ends by planting a REAL decision so Claude replies within seconds. That reply —
// to their own question, with their people invitable right there — is the hit of
// delight and the answer to "why ThinkThru".
//
// Shows once per device (localStorage), skippable any time, new users only.

const EXAMPLES = [
  "Which school for our kid?",
  "Where should we go for the holidays?",
  "Should we take the new job offer?",
  "How do we care for our parents?",
];

// The whole app, in three words.
const STEPS3 = [
  { emoji: "💬", label: "Discuss", sub: "Everyone shares their take — with Claude thinking alongside you." },
  { emoji: "⚖️", label: "Decide", sub: "Weigh what matters, so it's the fair answer — not the loudest voice." },
  { emoji: "🌸", label: "Bloom", sub: "It settles into one decision your people keep, forever." },
];

const LAST = 3; // step index of the "do it now" screen

export function WelcomeFlow() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0); // 0 hook · 1 why-not-chatgpt · 2 three-steps · 3 do
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem("thinkthru_welcome_done")) setShow(true);
    } catch {
      /* private mode — just don't show */
    }
  }, []);

  function done() {
    try {
      localStorage.setItem("thinkthru_welcome_done", "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  async function start() {
    const t = title.trim();
    if (t.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { seedId } = await apiPost<{ seedId: string }>("/api/quick-start", { title: t });
      try {
        localStorage.setItem("thinkthru_welcome_done", "1");
      } catch {
        /* ignore */
      }
      router.push(`/seeds/${seedId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[#070d07]">
      <div className="garden-bg" />
      {/* Skip — always there so it never feels like a trap. */}
      <div className="relative z-10 flex justify-end p-4">
        {step < LAST && (
          <button onClick={done} className="text-xs text-ink-soft transition hover:text-ink">
            Skip
          </button>
        )}
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        {/* ── 0 · The hook (a question they're already asking) ── */}
        {step === 0 && (
          <div className="max-w-md animate-[fadeUp_0.5s_ease-out]">
            <div className="mb-5 text-5xl">🌱</div>
            <h1 className="serif-xl mb-4">Got a big decision coming up with your people?</h1>
            <p className="text-lg text-ink-mid">
              Which school. Where to live. Whether to take the offer. The ones that matter never
              really fit in a group chat, do they?
            </p>
          </div>
        )}

        {/* ── 1 · The one objection, answered ── */}
        {step === 1 && (
          <div className="max-w-md animate-[fadeUp_0.5s_ease-out]">
            <p className="mb-4 rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-sm italic text-ink-soft">
              “But can’t I just ask ChatGPT or Claude myself?”
            </p>
            <h2 className="serif-lg mb-3">You can — on your own.</h2>
            <p className="text-base text-ink-mid">
              ThinkThru is different: it brings your{" "}
              <span className="text-ink">people</span> <em>and</em> AI into the same room. Everyone’s
              voice, weighed fairly, with Claude thinking alongside all of you —{" "}
              <span className="font-serif italic text-bloom">
                not one person and a bot, but your whole circle deciding together
              </span>
              .
            </p>
          </div>
        )}

        {/* ── 2 · The whole app, in three steps ── */}
        {step === 2 && (
          <div className="w-full max-w-md animate-[fadeUp_0.5s_ease-out]">
            <p className="eyebrow mb-5">And it’s just three simple steps</p>
            <div className="space-y-3 text-left">
              {STEPS3.map((h, i) => (
                <div
                  key={h.label}
                  className="flex items-start gap-3 rounded-2xl border border-[rgba(76,175,80,0.22)] bg-[rgba(76,175,80,0.05)] p-4"
                  style={{ animation: `fadeUp 0.5s ease-out ${i * 0.15}s both` }}
                >
                  <span className="text-2xl" aria-hidden>{h.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{h.label}</p>
                    <p className="text-xs text-ink-soft">{h.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 3 · Your turn — plant a real one ── */}
        {step === 3 && (
          <div className="w-full max-w-md animate-[fadeUp_0.5s_ease-out]">
            <div className="mb-3 text-4xl">✨</div>
            <h2 className="serif-lg mb-2">Alright — your turn. What should we decide?</h2>
            <p className="mb-4 text-sm text-ink-mid">
              Ask one real thing you’d love to sort out with your family or friends. Claude replies
              right away — then you add your people.
            </p>
            <textarea
              className="input min-h-[56px] w-full text-left"
              placeholder="Type it in your own words…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) start();
              }}
            />
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setTitle(ex)}
                  className="rounded-full border border-[rgba(76,175,80,0.25)] bg-[rgba(76,175,80,0.06)] px-2.5 py-1 text-[11px] text-ink-mid transition hover:border-accent"
                >
                  {ex}
                </button>
              ))}
            </div>
            {error && <p className="mt-2 text-xs text-[#e57373]">{error}</p>}
            <button
              onClick={start}
              disabled={busy || title.trim().length < 4}
              className="btn-primary mt-4 w-full disabled:opacity-50"
            >
              {busy ? "🌱 Planting your seed…" : "✨ Ask it — Claude replies right away"}
            </button>
            <button onClick={done} className="mt-3 text-xs text-ink-soft transition hover:text-ink">
              I’ll explore first
            </button>
          </div>
        )}
      </div>

      {/* ── Progress dots + Next ── */}
      <div className="relative z-10 flex items-center justify-between px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === step ? 20 : 6, background: i === step ? "#66BB6A" : "rgba(255,255,255,0.2)" }}
            />
          ))}
        </div>
        {step < LAST ? (
          <button onClick={() => setStep((s) => s + 1)} className="btn-primary px-6">
            {step === 1 ? "Show me →" : step === 2 ? "Let’s go →" : "Next →"}
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
