"use client";

import { useEffect, useMemo, useState } from "react";
import { STAKE_DIMENSIONS } from "@/lib/constants";
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
  crossedBy: number;
  iCrossed: boolean;
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
  myCrosses: string[];
  carriesHeadline: string | null;
  pendingAdmissions: {
    candidateId: string;
    name: string;
    image: string | null;
    approvalPct: number;
    iCanVote: boolean;
    myApprove: boolean | null;
  }[];
  ratersSubmitted: number;
  totalRaters: number;
  threshold: number;
  bloomProgress: { configured: boolean; pct: number; threshold: number; yesVoters: number };
  participants: Participant[];
};

export function StakeBoard({
  seedId,
  onClose,
  onChange,
  initial,
  embedded = false,
}: {
  seedId: string;
  onClose: () => void;
  onChange?: (b: Board) => void;
  initial?: Board | null;
  embedded?: boolean;
}) {
  const [board, setBoard] = useState<Board | null>(initial ?? null);
  const [draft, setDraft] = useState<Record<string, Record<string, number>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  function applyBoard(b: Board) {
    setBoard(b);
    onChange?.(b);
  }

  // Seed the draft: each dimension is a pie split across non-opted people. Use my
  // saved read when complete, else an equal split (so it starts summing to 100).
  function seedDraft(b: Board) {
    const people = b.participants.filter((p) => !p.optedOut);
    const d: Record<string, Record<string, number>> = {};
    for (const p of b.participants) d[p.id] = {};
    for (const dim of b.activeDimensions) {
      const saved = people.map((p) => b.myRatings[p.id]?.[dim]);
      const complete = saved.length > 0 && saved.every((v) => typeof v === "number");
      people.forEach((p, i) => {
        d[p.id][dim] = complete ? (saved[i] as number) : people.length ? Math.round(100 / people.length) : 0;
      });
    }
    setDraft(d);
    setEditing(!b.iSubmitted);
  }

  async function load() {
    try {
      const b = await apiGet<Board>(`/api/seeds/${seedId}/stake`);
      applyBoard(b);
      seedDraft(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the stake board");
    }
  }

  useEffect(() => {
    if (initial) seedDraft(initial);
    else load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coupled allocation: changing one person's share in a dimension rebalances the
  // others proportionally so the dimension always sums to 100.
  function setDimValue(dim: string, rateeId: string, raw: number) {
    if (!board) return;
    const val = Math.max(0, Math.min(100, Math.round(raw)));
    const others = board.participants.filter((p) => !p.optedOut && p.id !== rateeId);
    setDraft((prev) => {
      const next = { ...prev, [rateeId]: { ...prev[rateeId], [dim]: val } };
      const remainder = 100 - val;
      const curSum = others.reduce((s, p) => s + (prev[p.id]?.[dim] ?? 0), 0);
      for (const p of others) {
        const cur = prev[p.id]?.[dim] ?? 0;
        const share = curSum > 0 ? (cur / curSum) * remainder : others.length ? remainder / others.length : 0;
        next[p.id] = { ...next[p.id], [dim]: Math.round(share) };
      }
      return next;
    });
  }

  // Your personal read (local-only): average of your shares across dimensions.
  const myReadWeights = useMemo(() => {
    if (!board) return {} as Record<string, number>;
    const people = board.participants.filter((p) => !p.optedOut);
    const dims = board.activeDimensions;
    const out: Record<string, number> = {};
    for (const p of people) {
      let t = 0;
      for (const dim of dims) t += draft[p.id]?.[dim] ?? 0;
      out[p.id] = dims.length ? Math.round(t / dims.length) : 0;
    }
    return out;
  }, [board, draft]);

  async function save(submit: boolean) {
    if (!board) return;
    setBusy(true);
    setError(null);
    try {
      const ratings = board.participants
        .filter((p) => !p.optedOut)
        .map((p) => ({ rateeId: p.id, scores: draft[p.id] ?? {} }));
      const b = await apiPost<Board>(`/api/seeds/${seedId}/stake`, { ratings, submit });
      applyBoard(b);
      if (submit) {
        setEditing(false);
        playNatureSound("bloom");
      } else playNatureSound("drop");
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
      if (body.cross) {
        seedDraft(data as Board); // opt/cross changes the pie
        playNatureSound("wind");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function voteAdmission(candidateId: string, approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const b = await apiPost<Board>(`/api/seeds/${seedId}/stake/admission`, { candidateId, approve });
      applyBoard(b);
      seedDraft(b); // admission may have reopened the board
      playNatureSound(approve ? "bloom" : "wind");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't vote");
    } finally {
      setBusy(false);
    }
  }

  function toggleDimension(dim: string) {
    if (!board) return;
    const set = new Set(board.activeDimensions);
    if (set.has(dim)) set.delete(dim);
    else set.add(dim);
    if (set.size === 0) return;
    patch({ activeDimensions: [...set] }).then(() => {
      if (board) seedDraft({ ...board, activeDimensions: [...set] });
    });
  }

  if (!board) {
    return (
      <Shell onClose={onClose} embedded={embedded}>
        <p className="p-8 text-center text-sm text-ink-soft">{error ?? "Loading the stake board…"}</p>
      </Shell>
    );
  }

  const activeDims = STAKE_DIMENSIONS.filter((d) => board.activeDimensions.includes(d.key));
  const people = board.participants.filter((p) => !p.optedOut);
  const sorted = [...board.participants].sort((a, b) => (b.stake?.weight ?? 0) - (a.stake?.weight ?? 0));

  return (
    <Shell onClose={onClose} embedded={embedded}>
      <div className={embedded ? "px-1 py-1" : "max-h-[88vh] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6"}>
        {/* Header */}
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">⚖️ Decision weight</p>
            <h2 className="serif-lg">Who carries this decision?</h2>
          </div>
          {!embedded && (
            <button onClick={onClose} className="text-ink-soft transition hover:text-ink" title="Close" aria-label="Close">
              ✕
            </button>
          )}
        </div>
        <p className="mb-5 max-w-2xl text-sm text-ink-mid">
          For each dimension, split it across the people who carry it. Reads stay{" "}
          <span className="text-ink">blind</span> until everyone submits — then the averaged map sets how
          much each bloom vote weighs.
        </p>

        {/* Progress + state */}
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[rgba(76,175,80,0.18)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
          <span className="text-sm text-ink">
            {board.ratersSubmitted}/{board.totalRaters} have weighed in
          </span>
          <div className="flex -space-x-1.5">
            {board.participants.map((p) => (
              <span key={p.id} title={`${p.name}${p.hasSubmitted ? " — submitted" : " — pending"}`} style={{ opacity: p.hasSubmitted ? 1 : 0.4 }}>
                <Avatar name={p.name} image={p.image} size={22} />
              </span>
            ))}
          </div>
          <span className="ml-auto text-xs" style={{ color: board.revealed ? "#66BB6A" : "#A0A890" }}>
            {board.locked ? "🔒 Locked for the vote" : board.revealed ? "👁 Revealed" : "🙈 Blind"}
          </span>
        </div>

        {/* Pending newcomer admissions — vote to add them to the quorum */}
        {board.pendingAdmissions.length > 0 && (
          <div className="mb-5 space-y-2">
            {board.pendingAdmissions.map((a) => (
              <div
                key={a.candidateId}
                className="rounded-2xl border border-[rgba(76,175,80,0.35)] bg-[rgba(76,175,80,0.06)] p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Avatar name={a.name} image={a.image} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      🙋 <span className="font-medium">{a.name}</span> wants into the decision
                    </p>
                    <p className="text-[11px] text-ink-soft">
                      {a.approvalPct}% of the stake approves · needs over 50% to reopen the board
                    </p>
                  </div>
                </div>
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                  <div
                    className="weight-bar-fill h-full rounded-full"
                    style={{
                      width: `${Math.min(100, a.approvalPct)}%`,
                      background: a.approvalPct > 50 ? "#4CAF50" : "rgba(76,175,80,0.5)",
                    }}
                  />
                </div>
                {a.iCanVote ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => voteAdmission(a.candidateId, true)}
                      disabled={busy}
                      className="rounded-full px-3 py-1 text-xs font-medium text-bg transition"
                      style={{ background: a.myApprove === true ? "#4CAF50" : "rgba(76,175,80,0.6)" }}
                    >
                      {a.myApprove === true ? "✓ Admitted" : "Admit"}
                    </button>
                    <button
                      onClick={() => voteAdmission(a.candidateId, false)}
                      disabled={busy}
                      className="rounded-full border px-3 py-1 text-xs transition"
                      style={{
                        borderColor: a.myApprove === false ? "#e57373" : "rgba(255,255,255,0.12)",
                        color: a.myApprove === false ? "#e57373" : "#A0A890",
                      }}
                    >
                      Not yet
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-ink-soft">Only current decision-makers vote on this.</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Active dimensions (consensus) */}
        <div className="mb-5">
          <p className="mb-2 text-xs text-ink-soft">
            Dimensions in play{board.canManage ? " · tap to rule one not-applicable" : " (set by the steward)"}
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
                  aria-pressed={on}
                  aria-label={`${d.label}${on ? "" : " (not applicable)"}`}
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

        {/* Revealed map */}
        {board.revealed && (
          <div className="mb-6 rounded-2xl border border-[rgba(255,179,0,0.25)] bg-[rgba(255,179,0,0.05)] p-4">
            {board.carriesHeadline && (
              <p className="serif-lg mb-3 text-bloom">🌸 {board.carriesHeadline}</p>
            )}
            <div className="space-y-2.5">
              {sorted.map((p) => (
                <WeightRow key={p.id} p={p} />
              ))}
            </div>
          </div>
        )}

        {/* Who's here — opt-out (self) + cross-out (others) */}
        <p className="eyebrow mb-2">👥 Who's here</p>
        <div className="mb-5 flex flex-wrap gap-2">
          {board.participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-full border px-2.5 py-1"
              style={{
                borderColor: p.isMe ? "rgba(76,175,80,0.35)" : "rgba(255,255,255,0.08)",
                opacity: p.optedOut ? 0.5 : 1,
              }}
            >
              <Avatar name={p.name} image={p.image} size={20} />
              <span className="text-xs text-ink">{p.name}</span>
              {editing && !p.optedOut && (
                <span className="text-[10px] text-accent">{myReadWeights[p.id] ?? 0}%</span>
              )}
              {p.crossedBy > 0 && (
                <span className="text-[10px] text-[#e57373]" title={`Crossed by ${p.crossedBy}`}>
                  ✕{p.crossedBy}
                </span>
              )}
              {p.isMe ? (
                <button
                  onClick={() => patch({ optedOut: !board.iOptedOut })}
                  disabled={busy}
                  aria-pressed={board.iOptedOut}
                  className="ml-1 inline-flex min-h-[24px] items-center text-[10px] transition"
                  style={{ color: board.iOptedOut ? "#66BB6A" : "#A0A890" }}
                  title="Your weight is shared equally among the others"
                >
                  {board.iOptedOut ? "↩ opt in" : "🙅 not me"}
                </button>
              ) : (
                <button
                  onClick={() => patch({ cross: { rateeId: p.id, crossed: !p.iCrossed } })}
                  disabled={busy}
                  aria-pressed={p.iCrossed}
                  aria-label={`Cross out ${p.name} — flag they shouldn't decide this`}
                  className="ml-1 inline-flex min-h-[24px] items-center text-[10px] transition"
                  style={{ color: p.iCrossed ? "#e57373" : "#828B79" }}
                  title="Cross out — flag they shouldn't decide this (reduces their weight)"
                >
                  {p.iCrossed ? "✕ crossed" : "✕ cross"}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Allocate — one pie per dimension */}
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow">{editing ? "✍️ Split each dimension" : "✅ You submitted"}</p>
          {board.iSubmitted && !editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-ink-mid underline hover:text-ink">
              edit my read
            </button>
          )}
        </div>

        {editing ? (
          people.length < 2 ? (
            <p className="rounded-xl border border-[rgba(255,255,255,0.07)] p-4 text-sm text-ink-soft">
              You&apos;re the only one carrying stake right now — you hold 100%. Once others join (or opt
              back in) you&apos;ll split each dimension across the group.
            </p>
          ) : (
            <div className="space-y-3">
              {activeDims.map((d) => {
                const sum = people.reduce((s, p) => s + (draft[p.id]?.[d.key] ?? 0), 0);
                return (
                  <div key={d.key} className="rounded-2xl border border-[rgba(255,255,255,0.07)] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: d.color }}>
                        {d.emoji} {d.label}
                      </span>
                      <span className="text-[10px] text-ink-soft" title={d.blurb}>
                        {sum === 100 ? "100%" : `${sum}%`}
                      </span>
                    </div>
                    {/* Stacked preview bar */}
                    <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                      {people.map((p, i) => (
                        <span
                          key={p.id}
                          title={`${p.name} ${draft[p.id]?.[d.key] ?? 0}%`}
                          style={{
                            width: `${draft[p.id]?.[d.key] ?? 0}%`,
                            background: d.color,
                            opacity: 1 - i * 0.13,
                          }}
                        />
                      ))}
                    </div>
                    <div className="space-y-2">
                      {people.map((p) => {
                        const v = draft[p.id]?.[d.key] ?? 0;
                        return (
                          <div key={p.id} className="flex items-center gap-2">
                            <Avatar name={p.name} image={p.image} size={18} />
                            <span className="w-16 shrink-0 truncate text-xs text-ink-mid">{p.name}</span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={v}
                              onChange={(e) => setDimValue(d.key, p.id, Number(e.target.value))}
                              className="stake-range flex-1"
                              style={{ ["--dim" as string]: d.color, ["--fill" as string]: `${v}%` } as React.CSSProperties}
                            />
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={v}
                              onChange={(e) => setDimValue(d.key, p.id, Number(e.target.value))}
                              className="w-12 shrink-0 rounded-md border border-[rgba(76,175,80,0.2)] bg-[rgba(7,13,7,0.5)] px-1.5 py-0.5 text-right text-xs text-ink outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <p className="text-sm text-ink-mid">
            ✅ Your read is in. {board.revealed ? "The map above is live." : "It reveals once everyone submits."}
          </p>
        )}

        {error && <p className="mt-3 text-sm text-[#e57373]">{error}</p>}

        {/* Footer */}
        <div className="sticky bottom-0 mt-5 flex flex-wrap items-center gap-2 border-t border-[rgba(76,175,80,0.15)] bg-[rgba(10,16,10,0.92)] py-3 backdrop-blur">
          {editing && people.length >= 2 ? (
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
              {board.iSubmitted ? "✅ Your read is in." : "Split each dimension, then submit."}
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

function Shell({
  children,
  onClose,
  embedded,
}: {
  children: React.ReactNode;
  onClose: () => void;
  embedded?: boolean;
}) {
  if (embedded) return <div>{children}</div>;
  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-[rgba(6,10,6,0.78)] px-3 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-2xl animate-[fadeUp_0.35s_ease-out]">
        {children}
      </div>
    </div>
  );
}

function WeightRow({ p }: { p: Participant }) {
  const w = Math.round(p.stake?.weight ?? 0);
  const dim = p.optedOut || p.crossedBy > 0;
  return (
    <div className="flex items-center gap-3" style={{ opacity: p.optedOut ? 0.5 : 1 }}>
      <Avatar name={p.name} image={p.image} size={26} />
      <span className="flex w-28 shrink-0 items-center gap-1 truncate text-sm text-ink">
        {p.name}
        {p.crossedBy > 0 && <span className="text-[10px] text-[#e57373]">✕{p.crossedBy}</span>}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        <div
          className="weight-bar-fill h-full rounded-full"
          style={{ width: `${p.optedOut ? 0 : w}%`, background: "linear-gradient(to right,#FFD54F,#FF8F00)" }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-sm font-semibold" style={{ color: dim ? "#A0A890" : "#FFB300" }}>
        {p.optedOut ? "—" : `${w}%`}
      </span>
    </div>
  );
}
