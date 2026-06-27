"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STAKE_DIMENSIONS, DIMENSIONS } from "@/lib/constants";
import { apiGet, apiPost } from "@/lib/client";
import { playNatureSound } from "@/lib/sound";
import { Avatar } from "@/components/Avatar";

type Stake = { dims: Record<string, number>; weight: number; raterCount: number } | null;
type Participant = {
  id: string;
  name: string;
  image: string | null;
  isMe: boolean;
  optedOut: boolean;
  hasSubmitted: boolean;
  contribution: { total: number; dims: Record<string, number> };
  stake: Stake;
};
export type Board = {
  seedId: string;
  phase: "collecting" | "revealed" | "locked";
  revealed: boolean;
  locked: boolean;
  activeDimensions: string[];
  optOuts: string[];
  iSubmitted: boolean;
  iOptedOut: boolean;
  iVotedBloom: boolean;
  canManage: boolean;
  myRatings: Record<string, Record<string, number>>;
  ratersSubmitted: number;
  totalRaters: number;
  threshold: number;
  bloomProgress: { configured: boolean; pct: number; threshold: number; yesVoters: number };
  participants: Participant[];
};

function dimMeta(key: string) {
  return STAKE_DIMENSIONS.find((d) => d.key === key)!;
}

export function StakeBoard({
  seedId,
  onClose,
  onChange,
  initial,
}: {
  seedId: string;
  onClose: () => void;
  onChange?: (b: Board) => void;
  initial?: Board | null;
}) {
  const [board, setBoard] = useState<Board | null>(initial ?? null);
  const [draft, setDraft] = useState<Record<string, Record<string, number>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false); // re-open my ratings after submit
  const scrollRef = useRef<HTMLDivElement>(null);

  function applyBoard(b: Board) {
    setBoard(b);
    onChange?.(b);
  }

  async function load() {
    try {
      const b = await apiGet<Board>(`/api/seeds/${seedId}/stake`);
      applyBoard(b);
      // Seed the draft from my saved ratings (default 0 for unrated dims).
      const d: Record<string, Record<string, number>> = {};
      for (const p of b.participants) {
        d[p.id] = {};
        for (const dim of b.activeDimensions) d[p.id][dim] = b.myRatings[p.id]?.[dim] ?? 0;
      }
      setDraft(d);
      setEditing(!b.iSubmitted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the stake board");
    }
  }

  useEffect(() => {
    if (initial) {
      const d: Record<string, Record<string, number>> = {};
      for (const p of initial.participants) {
        d[p.id] = {};
        for (const dim of initial.activeDimensions) d[p.id][dim] = initial.myRatings[p.id]?.[dim] ?? 0;
      }
      setDraft(d);
      setEditing(!initial.iSubmitted);
    } else {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setScore(rateeId: string, dim: string, val: number) {
    setDraft((prev) => ({ ...prev, [rateeId]: { ...prev[rateeId], [dim]: val } }));
  }

  // Your personal read (local-only): how YOU would weight people, from your own
  // sliders. Honest — it never leaks anyone else's blind ratings.
  const myReadWeights = useMemo(() => {
    if (!board) return {};
    const optSet = new Set(board.optOuts);
    const totals: Record<string, number> = {};
    let sum = 0;
    for (const p of board.participants) {
      if (optSet.has(p.id)) {
        totals[p.id] = 0;
        continue;
      }
      let t = 0;
      for (const dim of board.activeDimensions) t += draft[p.id]?.[dim] ?? 0;
      totals[p.id] = t;
      sum += t;
    }
    const out: Record<string, number> = {};
    for (const p of board.participants) out[p.id] = sum > 0 ? Math.round((totals[p.id] / sum) * 100) : 0;
    return out;
  }, [board, draft]);

  async function save(submit: boolean) {
    if (!board) return;
    setBusy(true);
    setError(null);
    try {
      const ratings = board.participants.map((p) => ({ rateeId: p.id, scores: draft[p.id] ?? {} }));
      const b = await apiPost<Board>(`/api/seeds/${seedId}/stake`, { ratings, submit });
      applyBoard(b);
      if (submit) {
        setEditing(false);
        playNatureSound("bloom");
      } else {
        playNatureSound("drop");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/seeds/${seedId}/stake/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed");
      applyBoard(data as Board);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleDimension(dim: string) {
    if (!board) return;
    const set = new Set(board.activeDimensions);
    if (set.has(dim)) set.delete(dim);
    else set.add(dim);
    if (set.size === 0) return; // keep at least one live
    patch({ activeDimensions: [...set] });
  }

  if (!board) {
    return (
      <Shell onClose={onClose}>
        <p className="p-8 text-center text-sm text-ink-soft">
          {error ?? "Loading the stake board…"}
        </p>
      </Shell>
    );
  }

  const activeDims = STAKE_DIMENSIONS.filter((d) => board.activeDimensions.includes(d.key));
  const sorted = [...board.participants].sort((a, b) => (b.stake?.weight ?? 0) - (a.stake?.weight ?? 0));

  return (
    <Shell onClose={onClose}>
      <div ref={scrollRef} className="max-h-[88vh] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
        {/* Header */}
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">⚖️ Decision weight</p>
            <h2 className="serif-lg">Who carries this decision?</h2>
          </div>
          <button onClick={onClose} className="text-ink-soft transition hover:text-ink" title="Close">
            ✕
          </button>
        </div>
        <p className="mb-5 max-w-2xl text-sm text-ink-mid">
          Allocate what each person brings to this seed. Everyone&apos;s read stays{" "}
          <span className="text-ink">blind</span> until all submit — then the averaged map decides how
          much each bloom vote weighs. The person who carries the most gets the most say.
        </p>

        {/* Progress + reveal state */}
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[rgba(76,175,80,0.18)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
          <span className="text-sm text-ink">
            {board.ratersSubmitted}/{board.totalRaters} have weighed in
          </span>
          <div className="flex -space-x-1.5">
            {board.participants.map((p) => (
              <span
                key={p.id}
                title={`${p.name}${p.hasSubmitted ? " — submitted" : " — pending"}`}
                className="rounded-full ring-2"
                style={{ ["--tw-ring-color" as string]: p.hasSubmitted ? "#4CAF50" : "rgba(255,255,255,0.1)" }}
              >
                <span style={{ opacity: p.hasSubmitted ? 1 : 0.4 }}>
                  <Avatar name={p.name} image={p.image} size={22} />
                </span>
              </span>
            ))}
          </div>
          <span className="ml-auto text-xs" style={{ color: board.revealed ? "#66BB6A" : "#A0A890" }}>
            {board.locked ? "🔒 Locked for the vote" : board.revealed ? "👁 Revealed" : "🙈 Blind"}
          </span>
        </div>

        {/* Active dimensions (consensus) */}
        <div className="mb-5">
          <p className="mb-2 text-xs text-ink-soft">
            Dimensions in play
            {board.canManage ? " · tap to rule one not-applicable" : " (set by the steward)"}
          </p>
          <div className="flex flex-wrap gap-2">
            {STAKE_DIMENSIONS.map((d) => {
              const on = board.activeDimensions.includes(d.key);
              return (
                <button
                  key={d.key}
                  onClick={() => board.canManage && toggleDimension(d.key)}
                  disabled={!board.canManage || busy}
                  title={d.blurb}
                  className="rounded-full border px-3 py-1 text-xs transition disabled:cursor-default"
                  style={{
                    color: on ? d.color : "#5A6456",
                    borderColor: on ? `${d.color}55` : "rgba(255,255,255,0.08)",
                    background: on ? `${d.color}14` : "transparent",
                    textDecoration: on ? "none" : "line-through",
                  }}
                >
                  {d.emoji} {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Revealed stake map */}
        {board.revealed && (
          <div className="mb-6 rounded-2xl border border-[rgba(255,179,0,0.25)] bg-[rgba(255,179,0,0.05)] p-4">
            <p className="eyebrow mb-3 text-bloom">🌸 The stake map · who decides</p>
            <div className="space-y-2.5">
              {sorted.map((p) => (
                <WeightRow key={p.id} p={p} />
              ))}
            </div>
          </div>
        )}

        {/* My allocation grid */}
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow">
            {editing ? "✍️ Your read" : "✅ You submitted"} · how much each person brings
          </p>
          {board.iSubmitted && !editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-ink-mid underline hover:text-ink">
              edit my read
            </button>
          )}
        </div>

        <div className="space-y-3">
          {board.participants.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border p-4"
              style={{
                borderColor: p.isMe ? "rgba(76,175,80,0.35)" : "rgba(255,255,255,0.07)",
                background: p.isMe ? "rgba(76,175,80,0.05)" : "rgba(255,255,255,0.02)",
                opacity: p.optedOut ? 0.55 : 1,
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar name={p.name} image={p.image} size={30} />
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                      {p.name}
                      {p.isMe && (
                        <span className="rounded-full bg-[rgba(76,175,80,0.15)] px-1.5 py-0.5 text-[10px] text-accent">
                          you
                        </span>
                      )}
                      {p.optedOut && (
                        <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[10px] text-ink-soft">
                          opted out
                        </span>
                      )}
                    </p>
                    <ContributionStrip contribution={p.contribution} />
                  </div>
                </div>
                {/* Your personal read of this person */}
                {editing && !p.optedOut && (
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-ink-soft">your read</p>
                    <p className="text-sm font-semibold" style={{ color: "#66BB6A" }}>
                      {myReadWeights[p.id] ?? 0}%
                    </p>
                  </div>
                )}
              </div>

              {/* Opt-out toggle on your own card */}
              {p.isMe && (
                <button
                  onClick={() => patch({ optedOut: !board.iOptedOut })}
                  disabled={busy}
                  className="mb-3 rounded-full border px-3 py-1 text-xs transition"
                  style={{
                    borderColor: board.iOptedOut ? "rgba(76,175,80,0.4)" : "rgba(255,255,255,0.1)",
                    color: board.iOptedOut ? "#66BB6A" : "#A0A890",
                  }}
                  title="Your weight is shared equally among the others"
                >
                  {board.iOptedOut ? "↩ I'll carry stake after all" : "🙅 Not required for me"}
                </button>
              )}

              {/* Sliders — only while editing and not opted out */}
              {editing && !p.optedOut ? (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {activeDims.map((d) => {
                    const val = draft[p.id]?.[d.key] ?? 0;
                    return (
                      <div key={d.key}>
                        <div className="mb-1 flex items-center justify-between text-[11px]">
                          <span style={{ color: d.color }}>
                            {d.emoji} {d.label}
                          </span>
                          <span className="text-ink-soft">{val}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={val}
                          onChange={(e) => setScore(p.id, d.key, Number(e.target.value))}
                          className="stake-range"
                          style={{ ["--dim" as string]: d.color, ["--fill" as string]: `${val}%` } as React.CSSProperties}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                !p.optedOut &&
                p.stake && <StakeShareBars dims={p.stake.dims} active={board.activeDimensions} />
              )}
            </div>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-[#e57373]">{error}</p>}

        {/* Footer actions */}
        <div className="sticky bottom-0 mt-5 flex flex-wrap items-center gap-2 border-t border-[rgba(76,175,80,0.15)] bg-[rgba(10,16,10,0.92)] py-3 backdrop-blur">
          {editing ? (
            <>
              <button onClick={() => save(true)} disabled={busy} className="btn-primary text-sm">
                {busy ? "Saving…" : board.iSubmitted ? "Update my read" : "Submit my read"}
              </button>
              <button onClick={() => save(false)} disabled={busy} className="btn-ghost text-sm">
                Save draft
              </button>
              <span className="text-xs text-ink-soft">Blind until everyone submits.</span>
            </>
          ) : (
            <span className="text-sm text-ink-mid">
              ✅ Your read is in. {board.revealed ? "The map above is live." : "It reveals once everyone submits."}
            </span>
          )}
          {board.canManage && (
            <div className="ml-auto flex gap-2">
              {!board.revealed && (
                <button onClick={() => patch({ phase: "revealed" })} disabled={busy} className="btn-ghost text-xs">
                  👁 Reveal now
                </button>
              )}
              <button
                onClick={() => patch({ phase: board.locked ? "revealed" : "locked" })}
                disabled={busy}
                className="btn-ghost text-xs"
              >
                {board.locked ? "🔓 Unlock" : "🔒 Lock for vote"}
              </button>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-[rgba(6,10,6,0.78)] px-3 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-2xl animate-[fadeUp_0.35s_ease-out]"
      >
        {children}
      </div>
    </div>
  );
}

// Profile A — a slim multi-color strip of how they shaped the conversation.
function ContributionStrip({ contribution }: { contribution: { total: number; dims: Record<string, number> } }) {
  if (contribution.total === 0) {
    return <p className="text-[11px] text-ink-soft">no messages yet</p>;
  }
  const segs = DIMENSIONS.filter((d) => (contribution.dims[d.key] ?? 0) > 0);
  return (
    <div className="mt-0.5 flex items-center gap-1.5">
      <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        {segs.map((d) => (
          <span key={d.key} style={{ width: `${contribution.dims[d.key]}%`, background: d.color }} title={`${d.label} ${contribution.dims[d.key]}%`} />
        ))}
      </div>
      <span className="text-[10px] text-ink-soft">{contribution.total} msg</span>
    </div>
  );
}

// Per-dimension share bars (shown for others once revealed / after you submit).
function StakeShareBars({ dims, active }: { dims: Record<string, number>; active: string[] }) {
  const shown = STAKE_DIMENSIONS.filter((d) => active.includes(d.key));
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {shown.map((d) => {
        const v = Math.round(dims[d.key] ?? 0);
        return (
          <div key={d.key} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[11px]" style={{ color: d.color }}>
              {d.emoji} {d.label}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
              <div className="weight-bar-fill h-full rounded-full" style={{ width: `${v}%`, background: d.color }} />
            </div>
            <span className="w-8 shrink-0 text-right text-[10px] text-ink-soft">{v}%</span>
          </div>
        );
      })}
    </div>
  );
}

// A participant's overall bloom weight, big and clear.
function WeightRow({ p }: { p: Participant }) {
  const w = Math.round(p.stake?.weight ?? 0);
  return (
    <div className="flex items-center gap-3">
      <Avatar name={p.name} image={p.image} size={26} />
      <span className="w-24 shrink-0 truncate text-sm text-ink">{p.name}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        <div
          className="weight-bar-fill h-full rounded-full"
          style={{
            width: `${p.optedOut ? 0 : w}%`,
            background: "linear-gradient(to right,#FFD54F,#FF8F00)",
          }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-sm font-semibold text-bloom">
        {p.optedOut ? "—" : `${w}%`}
      </span>
    </div>
  );
}
