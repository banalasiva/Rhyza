"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/client";

// Post-signup, the selling is already done on the landing page — so this doesn't
// re-pitch. It pushes STRAIGHT to the one thing that delights: plant a real
// decision, and Claude replies within seconds. One focused screen, the example
// questions people love, and away they go.
//
// Shows once per device (localStorage), skippable, new users only.

// A gentle gradient — the first chips are light and low-stakes so nobody feels
// they must open with a life decision; the later ones show it handles the big
// stuff too.
const EXAMPLES = [
  "Where should we eat tonight?",
  "What should we name the team?",
  "Where should we go for the holidays?",
  "Should we take the new job offer?",
  "Which school for our kid?",
];

export function WelcomeFlow() {
  const router = useRouter();
  const [show, setShow] = useState(false);
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
      <div className="relative z-10 flex justify-end p-4">
        <button onClick={done} className="text-xs text-ink-soft transition hover:text-ink">
          Skip
        </button>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <div className="w-full max-w-md animate-[fadeUp_0.5s_ease-out]">
          <div className="mb-3 text-4xl">🌱</div>
          <h2 className="serif-xl mb-5">What’s on your mind?</h2>
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
            {busy ? "🌱 Starting…" : "Start"}
          </button>
          {/* One quiet, honest line — no name, no hype. Just enough that a reply
              appearing never feels like a surprise or a stranger. */}
          <p className="mt-2.5 text-xs text-ink-soft">
            You’ll get a thoughtful reply to get you going — invite people whenever you like.
          </p>
          <button onClick={done} className="mt-3 text-xs text-ink-soft transition hover:text-ink">
            I’ll explore first
          </button>
        </div>
      </div>
    </div>
  );
}
