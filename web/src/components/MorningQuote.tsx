"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client";
import { messageOfTheDay, type DailyMessage } from "@/lib/daily-messages";

// A gentle daily greeting on the home screen — "Good morning 🌱" plus a shared
// quote of the day. Warmth without a notification: it asks nothing, and it can
// be dismissed for the day. It reappears tomorrow with a new quote.
function greeting(hour: number): string {
  if (hour < 5) return "Still up 🌙";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Winding down 🌙";
}

function todayKey(now: Date): string {
  return `tt-morning-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function MorningQuote({ name }: { name?: string }) {
  // Render nothing until mounted so the server/client markup matches (the
  // greeting and the "already dismissed today" check both depend on the
  // viewer's local clock, which only exists in the browser).
  const [show, setShow] = useState(false);
  const [data, setData] = useState<{ greet: string; quote: DailyMessage; key: string } | null>(null);

  useEffect(() => {
    const now = new Date();
    const key = todayKey(now);
    try {
      if (localStorage.getItem(key) === "seen") return;
    } catch {
      /* private mode — just show it */
    }
    // Prefer the owner-curated message from the server; fall back instantly to
    // the built-in library if the request fails.
    let alive = true;
    apiGet<DailyMessage>("/api/daily-message")
      .then((m) => {
        if (alive) setData({ greet: greeting(now.getHours()), quote: m, key });
      })
      .catch(() => {
        if (alive) setData({ greet: greeting(now.getHours()), quote: messageOfTheDay(now), key });
      })
      .finally(() => {
        if (alive) setShow(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!show || !data) return null;

  const first = name ? name.split(" ")[0] : "";

  function dismiss() {
    try {
      localStorage.setItem(data!.key, "seen");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[rgba(76,175,80,0.22)] bg-[rgba(76,175,80,0.06)] p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          {data.greet}
          {first ? `, ${first}` : ""} 🌱
        </p>
        <p className="mt-1 text-sm italic leading-relaxed text-ink-mid">“{data.quote.text}”</p>
        {data.quote.author && <p className="mt-0.5 text-xs text-ink-soft">— {data.quote.author}</p>}
        {data.quote.action && (
          <p className="mt-2.5 flex items-start gap-1.5 border-t border-[rgba(76,175,80,0.15)] pt-2.5 text-xs font-medium text-accent">
            <span aria-hidden>→</span>
            <span>{data.quote.action}</span>
          </p>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss for today"
        className="shrink-0 rounded-full px-2 py-1 text-ink-soft transition hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
