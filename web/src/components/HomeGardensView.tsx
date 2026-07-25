"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { apiPost } from "@/lib/client";
import type { FeedItem } from "@/lib/services/feed";
import type { HomeGardenGroup } from "@/lib/services/home";

const COLLAPSE_KEY = "home_collapsed_gardens";

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

// Pinned first, then most-recently-active — mirrors the server sort so optimistic
// updates land in the same order.
function sortGroups(gs: HomeGardenGroup[]): HomeGardenGroup[] {
  return [...gs].sort((a, b) => {
    if (a.pinned !== b.pinned) return (a.pinned ? -1 : 1);
    const at = a.lastActivityAt ?? "";
    const bt = b.lastActivityAt ?? "";
    return at < bt ? 1 : at > bt ? -1 : 0;
  });
}

function SeedCard({ item, onHide }: { item: FeedItem; onHide: (id: string) => void }) {
  const bloomed = !!item.bloomId;
  return (
    <div className="relative">
      {/* Hide (✕) — declutter your Home. Absolutely positioned + stops the click
          from opening the seed. */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onHide(item.id);
        }}
        aria-label="Hide from your Home"
        title="Hide from your Home"
        className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-ink-soft transition hover:bg-white/10 hover:text-ink"
      >
        ✕
      </button>
      <Link
        href={`/seeds/${item.id}`}
        className="block rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(7,13,7,0.5)] p-4 pr-9 transition hover:border-accent"
      >
        <h3 className="serif-lg leading-snug text-ink">{item.title}</h3>
        {item.latest && (
          <p className="mt-2 line-clamp-2 text-sm text-ink-mid">
            <span className="text-ink-soft">{item.latest.author.split(" ")[0]}: </span>
            {item.latest.text}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3 text-xs text-ink-soft">
          <Avatar name={item.author.name} image={item.author.image} size={18} />
          <span title={`stage: ${item.stage}`}>{item.stageEmoji}</span>
          <span>💬 {item.contributionCount}</span>
          <span className="ml-auto">{timeAgo(item.lastActivityAt)}</span>
          <span className="text-accent">{bloomed ? "See the bloom →" : "Weigh in →"}</span>
        </div>
      </Link>
    </div>
  );
}

export function HomeGardensView({ groups: initial }: { groups: HomeGardenGroup[] }) {
  const [groups, setGroups] = useState<HomeGardenGroup[]>(initial);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // The last hide, with a snapshot to restore on Undo.
  const [undo, setUndo] = useState<{ prev: HomeGardenGroup[]; seedId: string } | null>(null);

  // Auto-dismiss the Undo bar after a few seconds.
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  // Restore remembered collapsed gardens.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (raw) setCollapsed(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);

  function persistCollapsed(next: Set<string>) {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }

  function toggleCollapse(gardenId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(gardenId)) next.delete(gardenId);
      else next.add(gardenId);
      persistCollapsed(next);
      return next;
    });
  }

  function togglePin(gardenId: string) {
    setGroups((gs) =>
      sortGroups(gs.map((g) => (g.garden.id === gardenId ? { ...g, pinned: !g.pinned } : g))),
    );
    apiPost(`/api/gardens/${gardenId}/pin`).catch(() => {
      // Revert on failure.
      setGroups((gs) =>
        sortGroups(gs.map((g) => (g.garden.id === gardenId ? { ...g, pinned: !g.pinned } : g))),
      );
    });
  }

  const hideSeed = useCallback((seedId: string) => {
    setGroups((gs) => {
      setUndo({ prev: gs, seedId }); // snapshot for Undo
      return gs
        .map((g) => ({ ...g, seeds: g.seeds.filter((s) => s.id !== seedId) }))
        // Drop a group that's now empty, unless it's pinned (keep it on top).
        .filter((g) => g.seeds.length > 0 || g.pinned);
    });
    apiPost(`/api/seeds/${seedId}/dismiss`).catch(() => {});
  }, []);

  function undoHide() {
    if (!undo) return;
    setGroups(undo.prev);
    // Un-hide server-side (DELETE isn't in the tiny client helper, so use fetch).
    fetch(`/api/seeds/${undo.seedId}/dismiss`, { method: "DELETE" }).catch(() => {});
    setUndo(null);
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] p-8 text-center">
        <p className="text-sm text-ink-mid">Nothing to read just yet.</p>
        <p className="mt-1 text-xs text-ink-soft">
          Start a decision or add people to a garden, and it’ll show up here. 🌱
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.garden.id);
        return (
          <section key={g.garden.id}>
            {/* Garden header — the relationship group. Tap the name to open it;
                pin keeps it on top; chevron collapses the group. */}
            <div className="mb-2 flex items-center gap-2">
              <button
                onClick={() => toggleCollapse(g.garden.id)}
                aria-label={isCollapsed ? "Expand" : "Collapse"}
                className="text-ink-soft transition hover:text-ink"
              >
                {isCollapsed ? "▸" : "▾"}
              </button>
              <Link
                href={`/gardens/${g.garden.id}`}
                className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink transition hover:text-accent"
              >
                <span aria-hidden>{g.garden.emoji}</span>
                <span className="truncate">{g.garden.name}</span>
                {g.pinned && <span aria-hidden title="Pinned">📌</span>}
              </Link>
              <span className="text-[11px] text-ink-soft">
                {g.seeds.length > 0
                  ? `${g.seeds.length} ${g.seeds.length === 1 ? "decision" : "decisions"}`
                  : "quiet"}
              </span>
              <button
                onClick={() => togglePin(g.garden.id)}
                aria-label={g.pinned ? "Unpin garden" : "Pin garden to top"}
                title={g.pinned ? "Unpin" : "Pin to top"}
                className={
                  "ml-auto rounded-full px-2 py-0.5 text-xs transition " +
                  (g.pinned
                    ? "text-accent hover:bg-[rgba(76,175,80,0.12)]"
                    : "text-ink-soft hover:text-ink")
                }
              >
                {g.pinned ? "📌 Pinned" : "📌 Pin"}
              </button>
            </div>

            {!isCollapsed && (
              <div className="space-y-3 border-l border-[rgba(76,175,80,0.15)] pl-3">
                {g.seeds.length === 0 ? (
                  <Link
                    href={`/gardens/${g.garden.id}#plant-seed`}
                    className="block rounded-xl border border-dashed border-[rgba(255,255,255,0.12)] p-3 text-center text-xs text-ink-soft transition hover:border-accent hover:text-ink"
                  >
                    No open decisions here — start one 🌱
                  </Link>
                ) : (
                  g.seeds.map((s) => <SeedCard key={s.id} item={s} onHide={hideSeed} />)
                )}
              </div>
            )}
          </section>
        );
      })}

      {/* Undo bar after a hide. */}
      {undo && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[rgba(76,175,80,0.3)] bg-[#0B120B] px-4 py-2 text-sm text-ink shadow-xl">
            <span>Hidden from your Home</span>
            <button onClick={undoHide} className="font-medium text-accent">
              Undo
            </button>
            <button
              onClick={() => setUndo(null)}
              aria-label="Dismiss"
              className="text-ink-soft transition hover:text-ink"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
