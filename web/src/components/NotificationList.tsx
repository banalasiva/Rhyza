"use client";

import Link from "next/link";
import { useState } from "react";

export type NotifItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string;
  unread: boolean;
};

// ThinkThru has no DMs, so we adapt Slack's All / DMs / Mentions / Threads into
// the categories that actually exist here:
//   Mentions — someone tagged you (@you / @claude etc.)
//   Replies  — new messages in a seed you're part of (the "threads" equivalent)
//   Updates  — outcomes: blooms, quorum reveals, endorsements, members joining
const TABS: { key: string; label: string; match: (type: string) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "mentions", label: "Mentions", match: (t) => t === "mention" },
  { key: "replies", label: "Replies", match: (t) => t === "contribution" },
  {
    key: "updates",
    label: "Updates",
    match: (t) => t !== "mention" && t !== "contribution",
  },
];

export function NotificationList({ items }: { items: NotifItem[] }) {
  const [tab, setTab] = useState("all");
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const shown = items.filter((n) => active.match(n.type));

  // Per-tab unread counts, for a small badge on each chip.
  const unreadFor = (t: (typeof TABS)[number]) =>
    items.filter((n) => n.unread && t.match(n.type)).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = t.key === tab;
          const badge = unreadFor(t);
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition"
              style={{
                borderColor: on ? "var(--accent)" : "var(--border)",
                background: on ? "var(--accent)" : "transparent",
                color: on ? "var(--bg)" : "var(--ink-soft)",
              }}
            >
              {t.label}
              {badge > 0 && (
                <span
                  className="rounded-full px-1.5 text-[10px] font-semibold"
                  style={{
                    background: on ? "var(--bg)" : "var(--accent)",
                    color: on ? "var(--accent)" : "var(--bg)",
                  }}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-soft">
          Nothing here yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((n) => (
            <li key={n.id}>
              <Link
                href={n.href}
                className={`card block p-4 ${n.unread ? "" : "opacity-60"}`}
                style={n.unread ? { borderColor: "var(--accent)" } : undefined}
              >
                <p className="text-sm text-ink">{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs text-ink-mid">{n.body}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
