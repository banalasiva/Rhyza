"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client";
import { inviteMessage } from "@/lib/invite";

type Pending = {
  id: string;
  email: string | null;
  place: string | null;
  seedId: string | null;
  link: string;
  invitedAt: string;
};

// "Waiting for them" — the people you invited who haven't joined yet, each with
// a one-tap nudge you send *yourself* over WhatsApp / your share sheet. The app
// can't reach a non-user; you can — and a hello from you converts far better
// than any automated reminder. No vendor needed (wa.me opens WhatsApp for you to
// pick the person); a WhatsApp Business / Exotel auto-send can layer on later.
const HIDDEN_KEY = "tt-waiting-hidden";
const COLLAPSE_KEY = "tt-waiting-collapsed";

function loadHidden(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function WaitingForThem() {
  const [invites, setInvites] = useState<Pending[] | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [nudged, setNudged] = useState<Set<string>>(new Set());
  // Locally hidden rows — "cross off" people you're done with, restorable in
  // case you hid someone by mistake. Kept on the device (no backend needed).
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // Whether the whole card is folded away. `null` = the user hasn't chosen, so
  // we fall back to a sensible default (collapsed once you're all caught up).
  const [collapsed, setCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    setHidden(loadHidden());
    try {
      const c = localStorage.getItem(COLLAPSE_KEY);
      if (c !== null) setCollapsed(c === "1");
    } catch {
      /* ignore */
    }
    apiGet<{ invites: Pending[] }>("/api/invites/pending")
      .then((r) => setInvites(r.invites))
      .catch(() => setInvites([]));
  }, []);

  function persistHidden(next: Set<string>) {
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }
  const hide = (id: string) => persistHidden(new Set(hidden).add(id));
  const restoreAll = () => persistHidden(new Set());

  if (!invites || invites.length === 0) return null;

  const visible = invites.filter((p) => !hidden.has(p.id));
  const hiddenCount = invites.length - visible.length;
  // Nothing left to show and nothing hidden → collapse entirely.
  if (visible.length === 0 && hiddenCount === 0) return null;

  // Default to folded once there's no one actively waiting on you; otherwise
  // stay open. A tap remembers the choice for next time.
  const isCollapsed = collapsed ?? visible.length === 0;
  function toggleCollapsed() {
    const next = !isCollapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const message = (p: Pending) =>
    inviteMessage({ place: p.place ?? undefined, link: p.link, email: p.email ?? undefined });

  const markNudged = (id: string) => setNudged((s) => new Set(s).add(id));

  function whatsapp(p: Pending) {
    // No stored number needed — wa.me with just text opens WhatsApp so you pick
    // who to send it to (Mom, Dad, the group…).
    window.open(`https://wa.me/?text=${encodeURIComponent(message(p))}`, "_blank");
    markNudged(p.id);
  }

  async function share(p: Pending) {
    const text = message(p);
    if (canShare) {
      try {
        await navigator.share({ title: "Join me on ThinkThru 🌱", text });
        markNudged(p.id);
        return;
      } catch {
        /* cancelled — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      markNudged(p.id);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mb-5 rounded-2xl border border-[rgba(76,175,80,0.22)] bg-[rgba(76,175,80,0.05)] p-4">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={toggleCollapsed}
          aria-expanded={!isCollapsed}
          className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-ink transition hover:text-accent"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          <span aria-hidden className="text-[10px] text-ink-soft">{isCollapsed ? "▸" : "▾"}</span>
          🕊️ Waiting for them
          {isCollapsed && visible.length > 0 && (
            <span className="text-[11px] font-normal text-ink-soft">({visible.length})</span>
          )}
        </button>
        {!isCollapsed && hiddenCount > 0 && (
          <button
            onClick={restoreAll}
            className="shrink-0 text-[11px] text-ink-soft transition hover:text-ink"
            title="Bring back anyone you crossed off"
          >
            ↺ Show hidden ({hiddenCount})
          </button>
        )}
      </div>
      {isCollapsed ? null : (
      <>
      <p className="mb-3 mt-0.5 text-xs text-ink-soft">
        People you invited who haven’t joined yet. A hello from you means far more than any reminder.
      </p>
      {visible.length === 0 ? (
        <p className="py-2 text-center text-xs text-ink-soft">
          All caught up 🌱 {hiddenCount > 0 && "— tap “Show hidden” to bring anyone back."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(7,13,7,0.35)] p-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{p.email || "Someone you invited"}</p>
                {p.place && <p className="truncate text-[11px] text-ink-soft">for “{p.place}”</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => whatsapp(p)}
                  className="rounded-full border border-[rgba(37,211,102,0.45)] px-3 py-1.5 text-xs text-ink transition hover:bg-[rgba(37,211,102,0.12)]"
                >
                  {nudged.has(p.id) ? "✓ Sent" : "💬 WhatsApp"}
                </button>
                <button
                  onClick={() => share(p)}
                  aria-label="Share the invite another way"
                  className="rounded-full border border-[rgba(255,255,255,0.14)] px-2.5 py-1.5 text-xs text-ink-mid transition hover:text-ink"
                >
                  Share
                </button>
                <button
                  onClick={() => hide(p.id)}
                  aria-label="Cross off — they don't need a nudge"
                  title="Cross off (you can bring them back with “Show hidden”)"
                  className="rounded-full px-1.5 py-1 text-ink-soft transition hover:text-[#e57373]"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      </>
      )}
    </div>
  );
}
