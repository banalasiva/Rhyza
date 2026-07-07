"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/client";
import type { ReportRow } from "@/lib/services/reports";

export function ReportsQueue({ initial }: { initial: ReportRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, action: "remove" | "dismiss") {
    if (action === "remove" && !confirm("Remove this content? This can't be undone.")) return;
    setBusyId(id);
    try {
      await apiPost("/api/admin/reports", { reportId: id, action });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch {
      alert("Couldn't complete that — try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-ink-soft">✅ No open reports. All clear.</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="card p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-ink">
                <span className="text-ink-soft">Reason:</span> {r.reason}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-soft">
                by {r.reporter} · {new Date(r.createdAt).toLocaleDateString()} ·{" "}
                {r.seedVisibility === "private" ? "🔒 private" : "🌍 public"} seed
              </p>
            </div>
          </div>

          {/* The flagged content */}
          {r.contributionId ? (
            <div className="mb-3 rounded-xl border border-[rgba(229,115,115,0.25)] bg-[rgba(229,115,115,0.06)] p-3">
              <p className="mb-1 text-[11px] text-ink-soft">
                Message by {r.contributionAuthor ?? "someone"}
                {r.contributionDeleted && " · already removed"}
              </p>
              <p className="line-clamp-4 text-sm text-ink-mid">{r.contributionText || "(no text)"}</p>
            </div>
          ) : (
            <p className="mb-3 text-xs text-ink-soft">
              Whole seed reported: <span className="text-ink-mid">“{r.seedTitle}”</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={r.contributionId ? `/seeds/${r.seedId}#c-${r.contributionId}` : `/seeds/${r.seedId}`}
              target="_blank"
              className="btn-ghost text-xs"
            >
              View in context ↗
            </Link>
            <button
              onClick={() => act(r.id, "remove")}
              disabled={busyId === r.id}
              className="rounded-full border border-[rgba(229,115,115,0.5)] px-3 py-1.5 text-xs text-[#e57373] transition hover:bg-[rgba(229,115,115,0.1)] disabled:opacity-50"
            >
              🗑 Remove content
            </button>
            <button
              onClick={() => act(r.id, "dismiss")}
              disabled={busyId === r.id}
              className="btn-ghost text-xs disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
