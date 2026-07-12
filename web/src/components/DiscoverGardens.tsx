"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Garden = {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  author: string;
  seedCount: number;
};

const KEY = "tt-discover-collapsed";

// Public gardens surfaced on Home so everyone — especially a just-signed-in
// person with nothing of their own yet — can see and learn what's here.
// Collapsible, and it remembers the choice.
export function DiscoverGardens({ gardens }: { gardens: Garden[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(KEY) === "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (gardens.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={toggle}
          aria-expanded={!collapsed}
          className="flex items-center gap-1.5 text-left"
        >
          <span
            aria-hidden
            className="text-ink-soft transition-transform"
            style={{ transform: collapsed ? "rotate(-90deg)" : "none" }}
          >
            ▾
          </span>
          <span className="eyebrow">🌳 Curious how others decide? Peek in</span>
        </button>
        <Link href="/explore" className="text-xs text-ink-soft transition hover:text-accent">
          See all →
        </Link>
      </div>

      {ready && !collapsed && (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {gardens.map((g) => (
            <Link
              key={g.id}
              href={`/gardens/${g.id}`}
              className="card w-56 shrink-0 p-4 transition hover:border-accent"
            >
              <div className="mb-1 text-2xl" aria-hidden>{g.emoji || "🌳"}</div>
              <p className="truncate font-serif text-base text-ink">{g.name}</p>
              {g.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-mid">{g.description}</p>
              )}
              <p className="mt-2 text-[11px] text-ink-soft">
                🌱 {g.seedCount} {g.seedCount === 1 ? "discussion" : "discussions"} · by {g.author}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
