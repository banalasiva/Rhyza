"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/client";
import { Avatar } from "@/components/Avatar";
import { ConnectButton } from "@/components/ConnectButton";
import type { FeedItem } from "@/lib/services/feed";

// One "Suggested for you" block is inserted after every this-many feed cards
// (Instagram-style), cycling through the discovery pool so each is different.
const SUGGEST_EVERY = 4;

type SuggPerson = {
  id: string;
  name: string;
  image: string | null;
  status: "none" | "pending_outgoing" | "pending_incoming";
};
type SuggGarden = {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  author: string;
  seedCount: number;
};
type SuggCard = { kind: "people"; people: SuggPerson[] } | { kind: "gardens"; gardens: SuggGarden[] };

// Interleave people (in threes) and gardens (in pairs) into a sequence of
// suggestion cards, so the feed alternates who-to-connect-with and
// what-to-explore as you scroll.
function buildSuggestionCards(people: SuggPerson[], gardens: SuggGarden[]): SuggCard[] {
  const cards: SuggCard[] = [];
  const p = [...people];
  const g = [...gardens];
  while (p.length || g.length) {
    if (p.length) cards.push({ kind: "people", people: p.splice(0, 3) });
    if (g.length) cards.push({ kind: "gardens", gardens: g.splice(0, 2) });
  }
  return cards;
}

function SuggestedForYou({ card }: { card: SuggCard }) {
  return (
    <section className="rounded-2xl border border-[rgba(76,175,80,0.22)] bg-[rgba(76,175,80,0.05)] p-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-soft">
        ✨ Suggested for you
      </p>
      {card.kind === "people" ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {card.people.map((p) => (
            <div
              key={p.id}
              className="flex w-32 shrink-0 flex-col items-center rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(7,13,7,0.35)] p-3 text-center"
            >
              <Link href={`/u/${p.id}`} aria-label={`View ${p.name}`}>
                <Avatar name={p.name} image={p.image} size={44} />
              </Link>
              <Link href={`/u/${p.id}`} className="mt-1.5 w-full truncate text-xs text-ink hover:text-accent">
                {p.name}
              </Link>
              <div className="mt-2">
                <ConnectButton userId={p.id} initialStatus={p.status} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {card.gardens.map((g) => (
            <Link
              key={g.id}
              href={`/gardens/${g.id}`}
              className="flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(7,13,7,0.35)] p-3 transition hover:border-accent"
            >
              <span className="text-2xl" aria-hidden>{g.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{g.name}</p>
                <p className="truncate text-[11px] text-ink-soft">
                  by {g.author} · {g.seedCount} {g.seedCount === 1 ? "seed" : "seeds"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-accent">Open →</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

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
  const [suggCards, setSuggCards] = useState<SuggCard[]>([]);
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

  // The discovery pool for the "Suggested for you" cards — fetched once and
  // woven between feed cards below. Best-effort: the feed works fine without it.
  useEffect(() => {
    apiGet<{ people: SuggPerson[]; gardens: SuggGarden[] }>("/api/me/suggestions")
      .then((r) => setSuggCards(buildSuggestionCards(r.people ?? [], r.gardens ?? [])))
      .catch(() => {});
  }, []);

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

  // Weave a "Suggested for you" card in after every SUGGEST_EVERY feed cards.
  // Once the feed is exhausted, keep flowing with any remaining suggestions so
  // it never dead-ends — the Instagram pattern.
  const rendered: ReactNode[] = [];
  let si = 0;
  items.forEach((item, i) => {
    rendered.push(<Card key={item.id} item={item} />);
    if ((i + 1) % SUGGEST_EVERY === 0 && si < suggCards.length) {
      rendered.push(<SuggestedForYou key={`sugg-${si}`} card={suggCards[si]} />);
      si += 1;
    }
  });
  if (done) {
    while (si < suggCards.length) {
      rendered.push(<SuggestedForYou key={`sugg-${si}`} card={suggCards[si]} />);
      si += 1;
    }
  }

  return (
    <div className="space-y-3">
      {rendered}
      {!done && (
        <div ref={sentinel}>
          <div className="space-y-3" aria-hidden={!loading}>
            <Skeleton />
            {!started && <Skeleton />}
          </div>
        </div>
      )}
      {done && items.length > 0 && (
        <p className="py-6 text-center text-xs text-ink-soft">
          You’re all caught up on your circle 🌱
        </p>
      )}
    </div>
  );
}
