"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client";
import type { FeedbackRow } from "@/lib/services/feedback";

const ICON: Record<string, string> = { bug: "🐞", idea: "💡", other: "💬" };

function ago(d: Date | string): string {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Owner queue for in-app feedback. Resolve to clear it; reopen if needed.
export function FeedbackQueue({ initial }: { initial: FeedbackRow[] }) {
  const [items, setItems] = useState<FeedbackRow[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, status: "open" | "resolved") {
    setBusyId(id);
    try {
      await apiPost("/api/admin/feedback", { id, status });
      setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    } catch {
      /* ignore */
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-ink-soft">No feedback yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((f) => (
        <li
          key={f.id}
          className={`rounded-2xl border p-4 ${
            f.status === "resolved"
              ? "border-[rgba(255,255,255,0.08)] opacity-60"
              : "border-[rgba(76,175,80,0.22)]"
          }`}
        >
          <div className="mb-1 flex items-center justify-between gap-2 text-xs text-ink-soft">
            <span>
              {ICON[f.kind] ?? "💬"} {f.reporter || "Someone"}
            </span>
            <span>{ago(f.createdAt)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-ink">{f.message}</p>
          {(f.path || f.userAgent) && (
            <p className="mt-2 break-words text-[11px] text-ink-soft">
              {f.path && <span className="text-accent">{f.path}</span>}
              {f.path && f.userAgent && " · "}
              {f.userAgent}
            </p>
          )}
          <div className="mt-3 flex justify-end">
            {f.status === "resolved" ? (
              <button
                onClick={() => setStatus(f.id, "open")}
                disabled={busyId === f.id}
                className="btn-ghost px-3 py-1 text-xs disabled:opacity-50"
              >
                Reopen
              </button>
            ) : (
              <button
                onClick={() => setStatus(f.id, "resolved")}
                disabled={busyId === f.id}
                className="btn-primary px-3 py-1 text-xs disabled:opacity-50"
              >
                {busyId === f.id ? "…" : "Mark resolved"}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
