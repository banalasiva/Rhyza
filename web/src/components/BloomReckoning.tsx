"use client";

import { useMemo, useState } from "react";

// The day-21 reckoning — JUDGEMENT, the fourth virtue we celebrate. A bloom is
// convergence; the reckoning is the honest look back weeks later: did it turn
// out well? Unlike the private reflection above it, this verdict is SHARED to
// the group by design — a collective reckoning that closes the loop. Casting it
// is met with a small "harvest" celebration: the courage to reckon honestly,
// whatever the verdict, is exactly the thing worth rewarding.

type Verdict = "well" | "mixed" | "regret";
type Voice = { name: string; verdict: Verdict; note: string | null };
type Reckoning = {
  opened: boolean;
  openedAt: string | null;
  dueAt: string;
  due: boolean;
  canReckon: boolean;
  myVerdict: Verdict | null;
  myNote: string | null;
  tally: { well: number; mixed: number; regret: number };
  total: number;
  voices: Voice[];
};

const VERDICTS: { key: Verdict; emoji: string; label: string; color: string }[] = [
  { key: "well", emoji: "🍎", label: "Turned out well", color: "#66BB6A" },
  { key: "mixed", emoji: "🍂", label: "Mixed", color: "#FFB300" },
  { key: "regret", emoji: "🌰", label: "Wish we'd chosen differently", color: "#e57373" },
];
const meta = (k: Verdict) => VERDICTS.find((v) => v.key === k)!;

// Fixed sparkle directions for the harvest celebration (no Math.random).
const SPARKS = [
  { dx: "-64px", dy: "-28px", e: "✨" },
  { dx: "60px", dy: "-32px", e: "🍂" },
  { dx: "-42px", dy: "34px", e: "🌾" },
  { dx: "50px", dy: "32px", e: "✨" },
  { dx: "0px", dy: "-62px", e: "🍎" },
  { dx: "-72px", dy: "6px", e: "🌾" },
  { dx: "72px", dy: "2px", e: "✨" },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// A gentle, deterministic read of where the group landed — a reflection, never a
// scoreboard. Only speaks once there are at least two voices.
function groupRead(t: { well: number; mixed: number; regret: number }, total: number): string {
  if (total < 2) return "The first look back. More voices sharpen it.";
  const { well, mixed, regret } = t;
  if (well >= mixed + regret && well >= regret) return "Looking back, this one landed well. 🍎";
  if (regret > well && regret >= mixed) return "Most would choose differently now — that's judgment, earned. 🌰";
  return "A mixed call, seen clearly — some good, some to learn from. 🍂";
}

export function BloomReckoning({ bloomId, initial }: { bloomId: string; initial: Reckoning }) {
  const [r, setR] = useState<Reckoning>(initial);
  const [picking, setPicking] = useState<Verdict | null>(initial.myVerdict);
  const [note, setNote] = useState(initial.myNote ?? "");
  const [editing, setEditing] = useState(!initial.myVerdict);
  const [busy, setBusy] = useState(false);
  const [celebrating, setCelebrating] = useState<Verdict | null>(null);

  // Active when the day-21 nudge has opened it, or it's simply old enough now.
  const active = r.opened || r.due;

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/blooms/${bloomId}/reckon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as Reckoning | null;
        if (data) setR(data);
        return data;
      }
    } catch {
      /* best-effort */
    } finally {
      setBusy(false);
    }
    return null;
  }

  async function openNow() {
    await post({ action: "open" });
  }

  async function cast() {
    if (!picking) return;
    const data = await post({ verdict: picking, note });
    if (data) {
      setEditing(false);
      setCelebrating(picking);
      setTimeout(() => setCelebrating(null), 1700);
    }
  }

  // ── Not open yet: a single quiet line, plus an early "look back now" for the
  //    people in the decision — so nobody has to wait for the nudge to reflect. ──
  if (!active) {
    return (
      <section className="mt-8">
        <div className="rounded-2xl border border-[rgba(255,179,0,0.16)] bg-[rgba(255,179,0,0.03)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="text-lg">🍂</span>
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-soft">
              The reckoning opens around{" "}
              <span className="text-ink-mid">{fmtDate(r.dueAt)}</span> — we&apos;ll nudge everyone to
              look back on how this turned out.
            </p>
            {r.canReckon && (
              <button
                onClick={openNow}
                disabled={busy}
                className="btn-ghost shrink-0 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Look back now →
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  const pill = (active_: boolean, color: string) =>
    `flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm transition active:scale-[0.98] ${
      active_
        ? "text-ink shadow-[0_0_16px_rgba(255,179,0,0.14)]"
        : "border-[rgba(255,255,255,0.12)] text-ink-mid hover:border-[rgba(255,179,0,0.4)] hover:text-ink"
    }`;

  const total = r.total;
  const maxCount = Math.max(1, r.tally.well, r.tally.mixed, r.tally.regret);

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <p className="eyebrow" style={{ color: "#FFB300" }}>
            🍂 The reckoning
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Weeks on — how did it actually turn out? A look back, together.
          </p>
        </div>
        {r.myVerdict && !editing && (
          <button
            onClick={() => {
              setPicking(r.myVerdict);
              setNote(r.myNote ?? "");
              setEditing(true);
            }}
            className="btn-ghost no-print shrink-0 px-3 py-1.5 text-xs"
          >
            ✎ Change
          </button>
        )}
      </div>

      <article className="relative overflow-hidden rounded-2xl border border-[rgba(255,179,0,0.22)] bg-[rgba(255,179,0,0.04)] p-5 sm:p-6">
        {/* ── Cast / change your verdict ── */}
        {editing ? (
          <div className="animate-[reflectStepIn_0.35s_ease-out]">
            <p className="mb-3 text-sm text-ink-mid">Your honest read:</p>
            <div className="flex flex-col gap-2">
              {VERDICTS.map((v) => {
                const on = picking === v.key;
                return (
                  <button
                    key={v.key}
                    onClick={() => setPicking(v.key)}
                    aria-pressed={on}
                    className={pill(on, v.color)}
                    style={
                      on
                        ? { borderColor: v.color, background: `${v.color}1A` }
                        : undefined
                    }
                  >
                    <span aria-hidden className="text-lg leading-none">{v.emoji}</span>
                    <span>{v.label}</span>
                  </button>
                );
              })}
            </div>
            {picking && (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="One line — what we learned (optional)"
                className="input mt-3 min-h-[80px] w-full text-[15px] leading-relaxed"
                maxLength={280}
              />
            )}
            <div className="mt-4 flex items-center justify-end gap-3">
              {r.myVerdict && (
                <button
                  onClick={() => {
                    setEditing(false);
                    setPicking(r.myVerdict);
                  }}
                  className="btn-ghost px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={cast}
                disabled={!picking || busy}
                className="rounded-full px-5 py-2 text-sm font-medium text-bg transition active:scale-95 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#FFD54F,#FF8F00)" }}
              >
                {busy ? "Saving…" : r.myVerdict ? "Update" : "Record it 🍂"}
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-[reflectStepIn_0.35s_ease-out]">
            {/* Your own verdict, settled. */}
            {r.myVerdict && (
              <div className="mb-4 flex items-center gap-2.5">
                <span aria-hidden className="text-xl leading-none">{meta(r.myVerdict).emoji}</span>
                <div>
                  <p className="text-sm text-ink">
                    You:{" "}
                    <span style={{ color: meta(r.myVerdict).color }}>{meta(r.myVerdict).label}</span>
                  </p>
                  {r.myNote && <p className="text-xs text-ink-mid">{r.myNote}</p>}
                </div>
              </div>
            )}

            {/* The group's read + the tally as gentle bars (a reflection, not a
                scoreboard). */}
            <p className="mb-3 text-sm text-ink-mid">{groupRead(r.tally, total)}</p>
            <div className="space-y-2">
              {VERDICTS.map((v) => {
                const c = r.tally[v.key];
                return (
                  <div key={v.key} className="flex items-center gap-2.5">
                    <span aria-hidden className="w-5 shrink-0 text-center text-sm">{v.emoji}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(c / maxCount) * 100}%`, background: v.color }}
                      />
                    </div>
                    <span className="w-4 shrink-0 text-right text-xs tabular-nums text-ink-soft">
                      {c}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-ink-soft">
              {total === 0
                ? "No verdicts yet — be the first to look back."
                : `${total} ${total === 1 ? "voice" : "voices"} so far`}
            </p>
          </div>
        )}

        {/* What others said, in their words. */}
        {!editing && r.voices.filter((v) => v.note).length > 0 && (
          <div className="mt-5 border-t border-[rgba(255,255,255,0.06)] pt-4">
            <p className="eyebrow mb-3">In their words</p>
            <div className="space-y-2.5">
              {r.voices
                .filter((v) => v.note)
                .map((v, i) => (
                  <div key={i} className="flex gap-2.5">
                    <span aria-hidden className="shrink-0 text-base leading-none">{meta(v.verdict).emoji}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium" style={{ color: meta(v.verdict).color }}>
                        {v.name}
                      </p>
                      <p className="text-sm text-ink-mid">{v.note}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Harvest celebration — honoring the judgement, not the verdict ── */}
        {celebrating && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0B120B]/85 backdrop-blur-sm">
            <div className="relative">
              <div className="animate-[reflectPop_0.7s_ease-out] text-6xl">
                {meta(celebrating).emoji}
              </div>
              {SPARKS.map((sp, i) => (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 text-lg"
                  style={
                    {
                      "--dx": sp.dx,
                      "--dy": sp.dy,
                      animation: "reflectSpark 0.9s ease-out forwards",
                      animationDelay: "0.1s",
                    } as React.CSSProperties
                  }
                >
                  {sp.e}
                </span>
              ))}
            </div>
            <p className="serif-lg mt-4 animate-[fadeUp_0.5s_ease-out]">You looked back</p>
            <p className="mt-1 max-w-[15rem] animate-[fadeUp_0.6s_ease-out] text-center text-xs text-ink-soft">
              Judging your own calls honestly — that&apos;s how judgment sharpens.
            </p>
          </div>
        )}
      </article>
    </section>
  );
}
