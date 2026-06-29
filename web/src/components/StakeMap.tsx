"use client";

import { Avatar } from "@/components/Avatar";
import type { Board } from "@/components/StakeBoard";

// Right-rail glance at the stake-weighted quorum: who carries the decision, how
// much of the stake has voted to bloom, and a nudge to open the Quorum tab.
export function StakeMap({
  board,
  onOpen,
  bloomed,
}: {
  board: Board | null;
  onOpen: () => void;
  bloomed?: boolean;
}) {
  if (!board) return null;

  const carriers = [...board.participants]
    .filter((p) => !p.optedOut && (p.stake?.weight ?? 0) > 0)
    .sort((a, b) => (b.stake?.weight ?? 0) - (a.stake?.weight ?? 0))
    .slice(0, 4);
  const revealed = board.revealed && carriers.length > 0;
  const prog = board.bloomProgress;
  const primary = !board.iSubmitted && !bloomed;

  return (
    <div
      className="mt-4 rounded-2xl border p-3"
      style={{
        borderColor: primary ? "rgba(76,175,80,0.45)" : "rgba(255,255,255,0.07)",
        background: primary ? "rgba(76,175,80,0.07)" : "rgba(255,255,255,0.03)",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">⚖️ Decision weight</p>
        {primary && (
          <span className="rounded-full bg-[rgba(76,175,80,0.15)] px-1.5 py-0.5 text-[9px] font-semibold text-accent">
            your move
          </span>
        )}
      </div>

      {board.carriesHeadline && revealed && (
        <p className="mb-2 text-sm font-medium text-bloom">🌸 {board.carriesHeadline}</p>
      )}

      {board.pendingAdmissions.length > 0 && (
        <button
          onClick={onOpen}
          className="mb-3 flex w-full items-center gap-1.5 rounded-lg border border-[rgba(76,175,80,0.35)] bg-[rgba(76,175,80,0.08)] px-2 py-1.5 text-left text-[11px] text-ink-mid transition hover:text-ink"
        >
          🙋 {board.pendingAdmissions.map((a) => a.name).join(", ")}{" "}
          {board.pendingAdmissions.length === 1 ? "wants" : "want"} into the decision —
          <span className="text-accent">vote</span>
        </button>
      )}

      {revealed ? (
        <>
          {prog?.configured && (
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-ink-soft">Stake voting bloom</span>
                <span className="text-bloom">
                  {prog.pct}% / {prog.threshold}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                <div
                  className="weight-bar-fill h-full rounded-full"
                  style={{
                    width: `${Math.min(100, prog.pct)}%`,
                    background:
                      prog.pct >= prog.threshold
                        ? "linear-gradient(to right,#FFD54F,#FF8F00)"
                        : "rgba(255,179,0,0.5)",
                  }}
                />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            {carriers.map((p) => {
              const w = Math.round(p.stake?.weight ?? 0);
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <Avatar name={p.name} image={p.image} size={20} />
                  <span className="w-16 shrink-0 truncate text-xs text-ink-mid">{p.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                    <div
                      className="weight-bar-fill h-full rounded-full"
                      style={{ width: `${w}%`, background: "linear-gradient(to right,#FFD54F,#FF8F00)" }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[10px] font-medium text-bloom">{w}%</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="mb-2 text-[11px] leading-relaxed text-ink-soft">
          Decide how much each person carries — the people bearing the consequences get the most say.
        </p>
      )}

      {primary ? (
        <button onClick={onOpen} className="btn-primary mt-3 w-full text-xs">
          ⚖️ Open the Decide tab
        </button>
      ) : (
        <button
          onClick={onOpen}
          className="mt-3 w-full rounded-full border border-[rgba(76,175,80,0.25)] px-3 py-1.5 text-xs text-ink-mid transition hover:text-ink"
        >
          ⚖️ Open the Decide tab
        </button>
      )}
    </div>
  );
}
