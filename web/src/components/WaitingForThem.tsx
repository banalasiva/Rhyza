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
export function WaitingForThem() {
  const [invites, setInvites] = useState<Pending[] | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [nudged, setNudged] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    apiGet<{ invites: Pending[] }>("/api/invites/pending")
      .then((r) => setInvites(r.invites))
      .catch(() => setInvites([]));
  }, []);

  if (!invites || invites.length === 0) return null;

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
      <p className="text-sm font-medium text-ink">🕊️ Waiting for them</p>
      <p className="mb-3 mt-0.5 text-xs text-ink-soft">
        People you invited who haven’t joined yet. A hello from you means far more than any reminder.
      </p>
      <ul className="space-y-2">
        {invites.map((p) => (
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
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
