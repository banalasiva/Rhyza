"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/client";

// The first minute — the part that has to earn the "oh, I get it" and then the
// rush. Three fast, visual beats a newcomer taps through in seconds (skippable
// any time), ending by planting a REAL decision so Claude replies within
// seconds. Not a text wall to read — a runway to the first hit of delight.
//
// Shows once per device (localStorage). Rendered only for brand-new users (the
// home empty state), so returning people never see it.

const EXAMPLES = [
  "Which school for our kid?",
  "Where should we go for the holidays?",
  "Should we take the new job offer?",
  "How do we care for our parents?",
];

const HOW = [
  { emoji: "💬", label: "Talk it through", sub: "You and your people — plus Claude — from every angle." },
  { emoji: "⚖️", label: "Weigh what matters", sub: "It adds up to one fair answer, not just the loudest voice." },
  { emoji: "🌸", label: "It blooms", sub: "Into one decision your family keeps, forever." },
];

export function WelcomeFlow() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0); // 0 why · 1 how · 2 do
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
      {/* Skip — always available so it never feels like a trap. */}
      <div className="relative z-10 flex justify-end p-4">
        {step < 2 && (
          <button onClick={done} className="text-xs text-ink-soft transition hover:text-ink">
            Skip
          </button>
        )}
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        {/* ── Step 0 · Why ── */}
        {step === 0 && (
          <div className="max-w-md animate-[fadeUp_0.5s_ease-out]">
            <div className="mb-5 text-5xl">🌱</div>
            <h1 className="serif-xl mb-4">The big decisions deserve better than a group chat.</h1>
            <p className="text-lg text-ink-mid">
              ThinkThru turns the messy back-and-forth into one clear answer —{" "}
              <span className="font-serif italic text-bloom">that everyone keeps</span>.
            </p>
          </div>
        )}

        {/* ── Step 1 · How ── */}
        {step === 1 && (
          <div className="w-full max-w-md animate-[fadeUp_0.5s_ease-out]">
            <p className="eyebrow mb-5">Here’s how it works</p>
            <div className="space-y-3 text-left">
              {HOW.map((h, i) => (
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

        {/* ── Step 2 · Do it now ── */}
        {step === 2 && (
          <div className="w-full max-w-md animate-[fadeUp_0.5s_ease-out]">
            <div className="mb-3 text-4xl">✨</div>
            <h2 className="serif-lg mb-2">Your turn — let’s try it right now.</h2>
            <p className="mb-4 text-sm text-ink-mid">
              What’s one thing you’d love to decide with your family or friends?
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
              {busy ? "🌱 Planting your seed…" : "✨ Start — Claude replies right away"}
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
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === step ? 20 : 6, background: i === step ? "#66BB6A" : "rgba(255,255,255,0.2)" }}
            />
          ))}
        </div>
        {step < 2 ? (
          <button onClick={() => setStep((s) => s + 1)} className="btn-primary px-6">
            Next →
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
