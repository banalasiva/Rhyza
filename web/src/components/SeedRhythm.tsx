"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/client";

// A live "rhythm" a group can put on a seed so a decision doesn't drift on
// forever — a real ticking countdown everyone can see and work to. Two phases:
// discuss, then decide. Owner/admins can add time or freeze the current phase
// ("we've talked enough" / "time's up, let's decide"). Or the deliberate
// opposite, "🕊️ no deadline, converge peacefully." When a phase's clock runs
// out, Claude also steps into the thread with a warm nudge toward the next step.

type Deadline = {
  mode: "paced" | "peaceful";
  discussBy: string | null;
  decideBy: string | null;
  setById: string;
  updatedAt: string;
} | null;

type Phase = "discuss" | "decide" | "over";

function phaseOf(dl: NonNullable<Deadline>, now: number): Phase {
  const d = dl.discussBy ? new Date(dl.discussBy).getTime() : null;
  const k = dl.decideBy ? new Date(dl.decideBy).getTime() : null;
  if (d && now < d) return "discuss";
  if (k && now < k) return "decide";
  return "over";
}

// Milliseconds → "1d 05:22:10" or "05:22:10" (HH:MM:SS, hours zero-padded).
function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const hms = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
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
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discussDays, setDiscussDays] = useState(2);
  const [decideDays, setDecideDays] = useState(1);
  const busyRef = useRef(false);
  busyRef.current = busy;

  // Load once, then keep in sync so another admin's extend/freeze reaches every
  // screen. Skip the refresh mid-action so an optimistic change isn't reverted.
  useEffect(() => {
    let alive = true;
    const load = () =>
      apiGet<Deadline>(`/api/seeds/${seedId}/deadline`)
        .then((d) => {
          if (alive) setDl(d);
        })
        .catch(() => {})
        .finally(() => {
          if (alive) setLoaded(true);
        });
    load();
    const t = setInterval(() => {
      if (!busyRef.current) load();
    }, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [seedId]);

  // The heartbeat — one tick a second so the countdown actually counts down.
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!active || !loaded) return null;
  if (!dl && !canManage) return null;

  async function post(body: unknown, optimistic?: Deadline) {
    setBusy(true);
    if (optimistic !== undefined) setDl(optimistic);
    try {
      const res = await apiPost<Deadline>(`/api/seeds/${seedId}/deadline`, body);
      setDl(res);
      setEditing(false);
    } catch {
      // Re-sync to the real state on failure.
      apiGet<Deadline>(`/api/seeds/${seedId}/deadline`).then(setDl).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  const setPaced = () => post({ mode: "paced", discussDays, decideDays });
  const setPeaceful = () => post({ mode: "peaceful" }, { mode: "peaceful", discussBy: null, decideBy: null, setById: "", updatedAt: "" });
  const remove = () => post({ mode: "clear" }, null);
  const extend = (minutes: number) => post({ action: "extend", minutes });
  const freeze = () => post({ action: "end" });

  const phase: Phase = dl && dl.mode === "paced" ? phaseOf(dl, nowMs) : "over";
  const target =
    dl?.mode === "paced"
      ? phase === "discuss"
        ? new Date(dl.discussBy!).getTime()
        : phase === "decide"
          ? new Date(dl.decideBy!).getTime()
          : null
      : null;
  const remaining = target != null ? target - nowMs : 0;

  return (
    <div className="mt-3 rounded-xl border border-[rgba(76,175,80,0.18)] bg-[rgba(76,175,80,0.05)] px-3 py-2.5">
      {/* ── Peaceful ── */}
      {dl?.mode === "peaceful" ? (
        <div className="flex items-center gap-2 text-[13px]">
          <span aria-hidden className="text-sm">🕊️</span>
          <span className="min-w-0 flex-1 text-ink-mid">
            No deadline — the group is converging peacefully, in its own time.
          </span>
          {canManage && !editing && (
            <button onClick={() => setEditing(true)} className="shrink-0 rounded-full px-2.5 py-1 text-xs text-accent transition hover:bg-[rgba(76,175,80,0.12)]">
              Change
            </button>
          )}
        </div>
      ) : dl?.mode === "paced" ? (
        // ── Paced: the live countdown ──
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                {phase === "discuss"
                  ? "🌱 Discussing — then decide"
                  : phase === "decide"
                    ? "⚖️ Deciding"
                    : "🌸 Decision time"}
              </p>
              {phase === "over" ? (
                <p className="mt-0.5 text-sm text-ink-mid">
                  Time’s up — {canManage ? "bloom it, add more time, or reopen." : "Claude is nudging the group toward a bloom."}
                </p>
              ) : (
                <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums text-ink" aria-live="off">
                  {fmt(remaining)}
                </p>
              )}
            </div>
            {phase !== "over" && (
              <p className="max-w-[7.5rem] shrink-0 text-right text-[11px] leading-tight text-ink-soft">
                {phase === "discuss" ? "left to talk it through" : "left to land the decision"}
              </p>
            )}
          </div>

          {canManage && !editing && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-ink-soft">Add time:</span>
              <TimeChip label="+1h" onClick={() => extend(60)} disabled={busy} />
              <TimeChip label="+6h" onClick={() => extend(360)} disabled={busy} />
              <TimeChip label="+1d" onClick={() => extend(1440)} disabled={busy} />
              {phase !== "over" && (
                <button
                  onClick={freeze}
                  disabled={busy}
                  className="rounded-full border border-[rgba(255,255,255,0.12)] px-2.5 py-1 text-xs text-ink-mid transition hover:border-accent hover:text-ink disabled:opacity-50"
                >
                  {phase === "discuss" ? "❄️ End discussion now" : "❄️ Close decision now"}
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                disabled={busy}
                className="ml-auto rounded-full px-2.5 py-1 text-xs text-accent transition hover:bg-[rgba(76,175,80,0.12)] disabled:opacity-50"
              >
                Change
              </button>
            </div>
          )}
        </div>
      ) : (
        // ── No rhythm yet (steward only, since non-managers are filtered above) ──
        <div className="flex items-center gap-2 text-[13px]">
          <span aria-hidden className="text-sm">🕰️</span>
          <span className="min-w-0 flex-1 text-ink-soft">
            No rhythm yet — set a gentle pace so the decision keeps moving.
          </span>
          <button onClick={() => setEditing(true)} className="shrink-0 rounded-full px-2.5 py-1 text-xs text-accent transition hover:bg-[rgba(76,175,80,0.12)]">
            Set a rhythm
          </button>
        </div>
      )}

      {/* ── The editor (steward) ── */}
      {editing && canManage && (
        <div className="mt-3 space-y-3 border-t border-[rgba(255,255,255,0.06)] pt-3">
          <p className="text-xs text-ink-soft">
            A rhythm keeps a decision from drifting. The clock starts ticking right away, and Claude
            steps in when each phase’s time comes — never to rush you, just to keep everyone moving.
          </p>

          <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(7,13,7,0.35)] p-3">
            <p className="mb-2 text-xs font-semibold text-ink">⏱️ Set a pace</p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-mid">
              <NumBox value={discussDays} onChange={setDiscussDays} /> days to
              <span className="text-ink">discuss</span>
              <span className="text-ink-soft">·</span>
              <NumBox value={decideDays} onChange={setDecideDays} /> more to
              <span className="text-ink">decide</span>
            </div>
            <button onClick={setPaced} disabled={busy} className="btn-primary mt-3 w-full py-1.5 text-sm">
              {busy ? "Setting…" : "🌱 Start this rhythm"}
            </button>
          </div>

          <button
            onClick={setPeaceful}
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
              <button onClick={remove} disabled={busy} className="text-xs text-ink-soft underline-offset-2 hover:underline">
                Remove rhythm
              </button>
            ) : (
              <span />
            )}
            <button onClick={() => setEditing(false)} className="text-xs text-ink-soft hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeChip({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-[rgba(76,175,80,0.3)] bg-[rgba(76,175,80,0.06)] px-2.5 py-1 text-xs font-medium text-accent transition hover:border-accent disabled:opacity-50"
    >
      {label}
    </button>
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
