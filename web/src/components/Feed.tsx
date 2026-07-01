"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/client";
import { Avatar } from "@/components/Avatar";
import type { FeedItem } from "@/lib/services/feed";

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

function Card({ item }: { item: FeedItem }) {
  const bloomed = !!item.bloomId;
  return (
    <Link
      href={`/seeds/${item.id}`}
      className="block rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(7,13,7,0.5)] p-4 transition hover:border-accent"
    >
      {/* garden + scope */}
      <div className="mb-2 flex items-center gap-2 text-xs text-ink-soft">
        <span>{item.garden.emoji}</span>
        <span className="truncate">{item.garden.name}</span>
        <span aria-hidden>·</span>
        <span className="shrink-0">
          {bloomed
            ? "🌸 Bloomed"
            : item.scope === "mine"
              ? item.visibility === "private"
                ? "🔒 Your circle"
                : "🌿 Your gardens"
              : "🌍 Community"}
        </span>
      </div>

      {/* the question */}
      <h3 className="serif-lg leading-snug text-ink">{item.title}</h3>

      {/* latest thought */}
      {item.latest && (
        <p className="mt-2 line-clamp-2 text-sm text-ink-mid">
          <span className="text-ink-soft">{item.latest.author.split(" ")[0]}: </span>
          {item.latest.text}
        </p>
      )}

      {/* footer */}
      <div className="mt-3 flex items-center gap-3 text-xs text-ink-soft">
        <span className="flex items-center gap-1">
          <Avatar name={item.author.name} image={item.author.image} size={18} />
        </span>
        <span title={`stage: ${item.stage}`}>{item.stageEmoji}</span>
        <span>💬 {item.contributionCount}</span>
        <span className="ml-auto">{timeAgo(item.lastActivityAt)}</span>
        <span className="text-accent">{bloomed ? "See the bloom →" : "Weigh in →"}</span>
      </div>
    </Link>
  );
}

function Skeleton() {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(7,13,7,0.35)] p-4">
      <div className="mb-2 h-3 w-1/3 rounded bg-[rgba(255,255,255,0.06)]" />
      <div className="mb-2 h-5 w-4/5 rounded bg-[rgba(255,255,255,0.08)]" />
      <div className="h-4 w-full rounded bg-[rgba(255,255,255,0.05)]" />
    </div>
  );
}

export function Feed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  // Keep the latest values in a ref so the observer callback never runs stale.
  const state = useRef({ cursor, done, loading });
  state.current = { cursor, done, loading };

  const loadMore = useCallback(async () => {
    if (state.current.loading || state.current.done) return;
    setLoading(true);
    try {
      const c = state.current.cursor;
      const qs = c ? `?cursor=${encodeURIComponent(c)}` : "";
      const res = await apiGet<{ items: FeedItem[]; nextCursor: string | null }>(`/api/feed${qs}`);
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...res.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(res.nextCursor);
      if (!res.nextCursor) setDone(true);
    } catch {
      setDone(true); // stop trying on error
    } finally {
      setLoading(false);
      setStarted(true);
    }
  }, []);

  // Initial load.
  useEffect(() => {
    loadMore();
  }, [loadMore]);

  // Infinite scroll — fetch the next page as the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "600px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  if (started && items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] p-8 text-center">
        <p className="text-sm text-ink-mid">Your feed will fill as your gardens grow.</p>
        <p className="mt-1 text-xs text-ink-soft">Plant a seed to start the first conversation. 🌱</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id} item={item} />
      ))}
      {!done && (
        <div ref={sentinel}>
          <div className="space-y-3" aria-hidden={!loading}>
            <Skeleton />
            {!started && <Skeleton />}
          </div>
        </div>
      )}
      {done && items.length > 0 && (
        <p className="py-6 text-center text-xs text-ink-soft">You’re all caught up 🌱</p>
      )}
    </div>
  );
}
