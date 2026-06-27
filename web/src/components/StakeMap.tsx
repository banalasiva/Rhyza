"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client";
import { Avatar } from "@/components/Avatar";
import { StakeBoard, type Board } from "@/components/StakeBoard";

// Right-rail summary of the stake-weighted quorum: who carries the decision,
// and how much of the *stake* has voted to bloom. Opens the full board.
export function StakeMap({ seedId, bloomed }: { seedId: string; bloomed?: boolean }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const b = await apiGet<Board>(`/api/seeds/${seedId}/stake`);
      setBoard(b);
    } catch {
      /* stake board optional — fail quiet */
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedId]);

  if (!loaded) return null;

  const carriers = board
    ? [...board.participants]
        .filter((p) => !p.optedOut && (p.stake?.weight ?? 0) > 0)
        .sort((a, b) => (b.stake?.weight ?? 0) - (a.stake?.weight ?? 0))
        .slice(0, 4)
    : [];
  const revealed = board?.revealed && carriers.length > 0;
  const prog = board?.bloomProgress;

  return (
    <>
      <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow">⚖️ Decision weight</p>
          {board && !board.iSubmitted && !bloomed && (
            <span className="rounded-full bg-[rgba(76,175,80,0.15)] px-1.5 py-0.5 text-[9px] font-semibold text-accent">
              weigh in
            </span>
          )}
        </div>

        {revealed ? (
          <>
            {/* Stake-weighted bloom progress */}
            {prog?.configured && (
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-ink-soft">Stake voting bloom</span>
                  <span className="text-bloom">{prog.pct}% / {prog.threshold}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                  <div
                    className="weight-bar-fill h-full rounded-full"
                    style={{
                      width: `${Math.min(100, prog.pct)}%`,
                      background: prog.pct >= prog.threshold
                        ? "linear-gradient(to right,#FFD54F,#FF8F00)"
                        : "rgba(255,179,0,0.5)",
                    }}
                  />
                </div>
              </div>
            )}
            {/* Carriers */}
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
            {board
              ? "Decide how much each person carries — the people bearing the consequences get the most say in the bloom."
              : "Set who carries this decision."}
          </p>
        )}

        <button
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-full border border-[rgba(76,175,80,0.25)] px-3 py-1.5 text-xs text-ink-mid transition hover:text-ink"
        >
          {board?.iSubmitted ? "⚖️ Open the stake board" : "⚖️ Weigh in on the decision"}
        </button>
      </div>

      {open && (
        <StakeBoard
          seedId={seedId}
          initial={board}
          onChange={(b) => setBoard(b)}
          onClose={() => {
            setOpen(false);
            load();
          }}
        />
      )}
    </>
  );
}
