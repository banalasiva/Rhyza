"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client";

// A gentle "rhythm" a group can put on a seed so a decision doesn't drift on
// forever — "2 days to discuss, 1 day to decide, and Claude keeps us moving" —
// or the deliberate opposite, "no deadline, we'll converge peacefully." Shown as
// a slim bar above the conversation. Stewards set and change it; everyone sees
// where things stand. Nothing is ever force-closed — when a phase's time comes,
// Claude just steps into the thread with a warm nudge toward the next step.

type Deadline = {
  mode: "paced" | "peaceful";
  discussBy: string | null;
  decideBy: string | null;
  setById: string;
  updatedAt: string;
} | null;

// "in 2 days", "in 5 hours", "in 20 min", or "now" for a future instant. For a
// past instant, returns null (the caller shows the "time's here" state instead).
function until(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 36) return `in ${hrs} ${hrs === 1 ? "hour" : "hours"}`;
  const dys = Math.round(hrs / 24);
  return `in ${dys} ${dys === 1 ? "day" : "days"}`;
}

export function SeedRhythm({
  seedId,
  canManage,
  active = true,
}: {
  seedId: string;
  canManage: boolean;
  active?: boolean;
}) {
  const [dl, setDl] = useState<Deadline>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discussDays, setDiscussDays] = useState(2);
  const [decideDays, setDecideDays] = useState(1);

  useEffect(() => {
    apiGet<Deadline>(`/api/seeds/${seedId}/deadline`)
      .then((d) => setDl(d))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [seedId]);

  // Don't show anything on a bloomed seed, or before the first load settles.
  if (!active || !loaded) return null;
  // No rhythm and the viewer can't set one → stay out of the way entirely.
  if (!dl && !canManage) return null;

  async function save(body: {
    mode: "paced" | "peaceful" | "clear";
    discussDays?: number;
    decideDays?: number;
  }) {
    setBusy(true);
    try {
      const res = await apiPost<Deadline>(`/api/seeds/${seedId}/deadline`, body);
      setDl(body.mode === "clear" ? null : res);
      setEditing(false);
    } catch {
      /* keep the sheet open on failure */
    } finally {
      setBusy(false);
    }
  }

  // ── The at-a-glance summary line ──
  let summary: React.ReactNode;
  if (!dl) {
    summary = (
      <span className="text-ink-soft">
        No rhythm yet — set a gentle pace, or let it grow in its own time.
      </span>
    );
  } else if (dl.mode === "peaceful") {
    summary = (
      <span className="text-ink-mid">
        🕊️ No deadline — the group is converging peacefully, in its own time.
      </span>
    );
  } else {
    const discussLeft = until(dl.discussBy);
    const decideLeft = until(dl.decideBy);
    if (discussLeft) {
      summary = (
        <span className="text-ink-mid">
          🌱 <b className="text-ink">Discussing</b> · {discussLeft} to talk it through, then decide.
        </span>
      );
    } else if (decideLeft) {
      summary = (
        <span className="text-ink-mid">
          ⚖️ <b className="text-ink">Deciding</b> · {decideLeft} to land it. Claude will help you converge.
        </span>
      );
    } else {
      summary = (
        <span className="text-ink-mid">
          🌸 <b className="text-ink">Decision time</b> — Claude is nudging the group toward a bloom.
        </span>
      );
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[rgba(76,175,80,0.18)] bg-[rgba(76,175,80,0.05)] px-3 py-2">
      <div className="flex items-center gap-2 text-[13px]">
        <span aria-hidden className="shrink-0 text-sm">🕰️</span>
        <div className="min-w-0 flex-1">{summary}</div>
        {canManage && !editing && (
          <button
            onClick={() => {
              // Seed the sliders from the current rhythm if there is one.
              setEditing(true);
            }}
            className="shrink-0 rounded-full px-2.5 py-1 text-xs text-accent transition hover:bg-[rgba(76,175,80,0.12)]"
          >
            {dl ? "Change" : "Set a rhythm"}
          </button>
        )}
      </div>

      {editing && canManage && (
        <div className="mt-3 space-y-3 border-t border-[rgba(255,255,255,0.06)] pt-3">
          <p className="text-xs text-ink-soft">
            A rhythm keeps a decision from drifting. Claude steps in when each phase’s time comes —
            never to rush you, just to keep everyone gently moving.
          </p>

          {/* Paced */}
          <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(7,13,7,0.35)] p-3">
            <p className="mb-2 text-xs font-semibold text-ink">⏱️ Set a pace</p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-mid">
              <NumBox value={discussDays} onChange={setDiscussDays} /> days to
              <span className="text-ink">discuss</span>
              <span className="text-ink-soft">·</span>
              <NumBox value={decideDays} onChange={setDecideDays} /> more to
              <span className="text-ink">decide</span>
            </div>
            <button
              onClick={() => save({ mode: "paced", discussDays, decideDays })}
              disabled={busy}
              className="btn-primary mt-3 w-full py-1.5 text-sm"
            >
              {busy ? "Setting…" : "🌱 Start this rhythm"}
            </button>
          </div>

          {/* Peaceful */}
          <button
            onClick={() => save({ mode: "peaceful" })}
            disabled={busy}
            className="flex w-full items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(7,13,7,0.35)] p-3 text-left transition hover:border-accent disabled:opacity-60"
          >
            <span aria-hidden className="text-base">🕊️</span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-ink">No deadline</span>
              <span className="block text-xs text-ink-soft">Converge peacefully, in your own time.</span>
            </span>
          </button>

          <div className="flex items-center justify-between">
            {dl ? (
              <button
                onClick={() => save({ mode: "clear" })}
                disabled={busy}
                className="text-xs text-ink-soft underline-offset-2 hover:underline"
              >
                Remove rhythm
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NumBox({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[rgba(76,175,80,0.3)] bg-[rgba(76,175,80,0.06)]">
      <button
        type="button"
        aria-label="fewer"
        onClick={() => onChange(Math.max(0, +(value - (value <= 1 ? 0.5 : 1)).toFixed(1)))}
        className="px-2 py-1 text-ink-soft transition hover:text-ink"
      >
        −
      </button>
      <span className="min-w-[2.5ch] text-center text-sm font-semibold text-ink">{value}</span>
      <button
        type="button"
        aria-label="more"
        onClick={() => onChange(Math.min(30, +(value + 1).toFixed(1)))}
        className="px-2 py-1 text-ink-soft transition hover:text-ink"
      >
        +
      </button>
    </span>
  );
}
