"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client";
import { shareCard } from "@/lib/share-card";
import type { DailyQuestionState } from "@/lib/services/daily-question";

// The daily question — ThinkThru's tiny everyday ritual. Read today's prompt,
// tap an answer, and instantly see how everyone else voted. Then share the card
// to a WhatsApp group or a story so the ritual spreads. One tap in, a little
// social reward out — the reason to open the app every day.
export function DailyQuestion() {
  const [state, setState] = useState<DailyQuestionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<DailyQuestionState>("/api/daily-question")
      .then((s) => {
        if (alive) setState(s);
      })
      .catch(() => {
        /* not migrated / offline — just don't show it */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return null;

  const answered = state.myChoice !== null;

  async function answer(choice: number) {
    if (busy) return;
    setBusy(true);
    // Optimistic: flip to results immediately.
    setState((s) => (s ? { ...s, myChoice: choice } : s));
    try {
      const fresh = await apiPost<DailyQuestionState>("/api/daily-question", { choice });
      setState(fresh);
    } catch {
      /* keep the optimistic view */
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!state) return;
    const top = topLine(state);
    const lines = state.options.map((opt, i) => {
      const pct = state.total ? Math.round((state.counts[i] / state.total) * 100) : 0;
      const mine = state.myChoice === i ? "  ✓" : "";
      return `${opt} — ${pct}%${mine}`;
    });
    try {
      const how = await shareCard(
        {
          eyebrow: "Daily Question",
          title: state.text,
          lines: top ? [top, "", ...lines] : lines,
          accent: "green",
        },
        {
          fileName: "thinkthru-daily.png",
          shareText: `${state.text} — what do you think? Answer on ThinkThru: https://thinkthru.app`,
        },
      );
      if (how === "downloaded") flash("Saved — share it anywhere 🌱");
    } catch {
      flash("Couldn't make the card");
    }
  }

  function flash(msg: string) {
    setShareMsg(msg);
    setTimeout(() => setShareMsg(null), 3000);
  }

  return (
    <section className="mb-5 rounded-2xl border border-[rgba(76,175,80,0.22)] bg-[rgba(76,175,80,0.06)] p-4">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
        <span aria-hidden>💭</span> Question of the day
      </p>
      <p className="mb-3 text-base font-medium leading-snug text-ink">{state.text}</p>

      {!answered ? (
        <div className="flex flex-col gap-2">
          {state.options.map((opt, i) => (
            <button
              key={i}
              disabled={busy}
              onClick={() => answer(i)}
              className="rounded-xl border border-[rgba(76,175,80,0.28)] bg-[var(--surface)] px-4 py-2.5 text-left text-sm text-ink transition hover:border-accent hover:bg-[rgba(76,175,80,0.08)] disabled:opacity-60"
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {state.options.map((opt, i) => {
              const pct = state.total ? Math.round((state.counts[i] / state.total) * 100) : 0;
              const mine = state.myChoice === i;
              return (
                <li key={i}>
                  <button
                    disabled={busy}
                    onClick={() => answer(i)}
                    className="relative block w-full overflow-hidden rounded-xl border border-[rgba(76,175,80,0.2)] bg-[var(--surface)] px-4 py-2.5 text-left disabled:opacity-60"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 rounded-xl bg-[rgba(76,175,80,0.16)] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                    <span className="relative flex items-center justify-between gap-3 text-sm">
                      <span className={mine ? "font-semibold text-ink" : "text-ink-mid"}>
                        {opt}
                        {mine && <span className="ml-1.5 text-accent">✓</span>}
                      </span>
                      <span className="shrink-0 tabular-nums text-ink-soft">{pct}%</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-ink-soft">
              {state.total} {state.total === 1 ? "answer" : "answers"} · tap to change
            </span>
            <button
              onClick={share}
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(76,175,80,0.3)] px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-[rgba(76,175,80,0.1)]"
            >
              <span aria-hidden>↗</span> Share
            </button>
          </div>
          {shareMsg && <p className="mt-2 text-xs text-ink-soft">{shareMsg}</p>}
        </>
      )}
    </section>
  );
}

// The headline for the share card — the winning option so far, if there's a
// clear leader worth showing.
function topLine(state: DailyQuestionState): string | null {
  if (!state.total) return null;
  let bestI = 0;
  for (let i = 1; i < state.counts.length; i++) {
    if (state.counts[i] > state.counts[bestI]) bestI = i;
  }
  const pct = Math.round((state.counts[bestI] / state.total) * 100);
  if (state.counts[bestI] === 0) return null;
  return `Most say: ${state.options[bestI]} (${pct}%)`;
}
