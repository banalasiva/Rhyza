"use client";

import { useEffect, useState } from "react";
import { VIRTUES } from "@/lib/recognition";
import { track } from "@/lib/analytics";

// The in-context recognition control, shown in a message's action sheet. You
// credit the author for a virtue (depth/judgement/taste/empathy) right on the
// message that earned it — the evidence stays attached, and their profile
// aggregates it. State is fetched on demand when the sheet opens, so this never
// touches the hot seed-thread payload.
export function RecognitionRow({
  contributionId,
  authorName,
}: {
  contributionId: string;
  authorName?: string | null;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/contributions/${contributionId}/recognize`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setCounts(d.counts ?? {});
        setMine(new Set<string>(d.mine ?? []));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [contributionId]);

  async function toggle(virtue: string) {
    if (busy) return;
    const has = mine.has(virtue);
    setBusy(virtue);
    // Optimistic — recognition should feel instant.
    setMine((prev) => {
      const n = new Set(prev);
      if (has) n.delete(virtue);
      else n.add(virtue);
      return n;
    });
    setCounts((prev) => ({ ...prev, [virtue]: Math.max(0, (prev[virtue] ?? 0) + (has ? -1 : 1)) }));
    if (!has) track("recognition_given", { virtue });
    try {
      await fetch(`/api/contributions/${contributionId}/recognize`, {
        method: has ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ virtue }),
      });
    } catch {
      /* keep the optimistic state — a background retry isn't worth the churn */
    } finally {
      setBusy(null);
    }
  }

  const first = authorName?.trim().split(/\s+/)[0] || "them";

  return (
    <div className="mb-3 rounded-xl border border-[rgba(76,175,80,0.18)] bg-[rgba(76,175,80,0.04)] p-3">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
        Recognize {first} for
      </p>
      <div className="flex flex-wrap gap-1.5">
        {VIRTUES.map((v) => {
          const has = mine.has(v.key);
          const n = counts[v.key] ?? 0;
          return (
            <button
              key={v.key}
              onClick={() => toggle(v.key)}
              aria-pressed={has}
              title={v.blurb}
              className={`inline-flex min-h-[34px] items-center gap-1 rounded-full border px-3 py-1 text-xs transition active:scale-110 ${
                has
                  ? "border-accent bg-[rgba(76,175,80,0.12)] text-accent"
                  : "border-[rgba(255,255,255,0.1)] text-ink-soft hover:text-ink"
              }`}
            >
              <span aria-hidden className="text-sm">
                {v.emoji}
              </span>
              <span>{v.label}</span>
              {n > 0 && <span className="font-medium">· {n}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
