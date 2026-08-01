import type { JudgementProfile } from "@/lib/services/judgement";

// Calibration — the JUDGEMENT signal, surfaced. How the decisions a person led
// actually turned out, judged by the room (not self-declared). Deliberately
// honest about small samples: below the floor it reads "still forming" rather
// than showing a number that doesn't mean anything yet.
export function Calibration({ data, self }: { data: JudgementProfile; self?: boolean }) {
  const who = self ? "You've" : "They've";
  const whoShort = self ? "your" : "their";

  // Cold-start state — not enough looked-back-on decisions to say anything true.
  if (!data.hasEnough) {
    if (data.reckoned === 0 && data.unfolding === 0) {
      return (
        <p className="text-xs leading-relaxed text-ink-soft">
          {self ? "Your" : "Their"} calibration takes shape as the decisions {self ? "you lead" : "they lead"} bloom
          and the room looks back on how they landed — honest about {whoShort} judgement in a way no badge is.
        </p>
      );
    }
    const seen = data.reckoned;
    const total = seen + data.unfolding;
    return (
      <div className="text-xs leading-relaxed text-ink-soft">
        <p className="text-ink-mid">Still forming.</p>
        <p className="mt-1">
          {who} led {total} {total === 1 ? "decision" : "decisions"} that bloomed
          {seen > 0 ? `, and the room has looked back on ${seen}` : ""}. A calibration appears once a few have
          landed — measured by how they turned out, not how popular they were.
        </p>
      </div>
    );
  }

  const pct = Math.round(data.landedWell * 100);

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-ink">{pct}%</span>
        <span className="text-xs text-ink-soft">
          landed well · {data.reckoned} {data.reckoned === 1 ? "decision" : "decisions"} looked back on
        </span>
      </div>

      {/* well / mixed / regret split — the room's collective verdicts. */}
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        <Bar n={data.well} total={data.reckoned} color="#4caf50" />
        <Bar n={data.mixed} total={data.reckoned} color="#b0a56f" />
        <Bar n={data.regret} total={data.reckoned} color="#c9736a" />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-soft">
        <Legend color="#4caf50" label="landed well" n={data.well} />
        <Legend color="#b0a56f" label="mixed" n={data.mixed} />
        <Legend color="#c9736a" label="regret" n={data.regret} />
        {data.unfolding > 0 && (
          <span className="inline-flex items-center gap-1 text-ink-soft">
            <span className="h-2 w-2 rounded-full bg-[rgba(255,255,255,0.25)]" aria-hidden />
            still unfolding <span className="text-ink-mid">{data.unfolding}</span>
          </span>
        )}
      </div>

      {/* Per-domain (garden) — where {whoShort} judgement is strongest, only for
          gardens with enough looked-back-on decisions to be real. */}
      {data.domains.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-ink-soft">By domain</p>
          {data.domains.map((d) => (
            <div key={d.garden} className="flex items-center gap-2">
              <span className="w-40 shrink-0 truncate text-xs text-ink-mid" title={d.garden}>
                {d.emoji} {d.garden}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                <div
                  className="h-full rounded-full bg-[#4caf50]"
                  style={{ width: `${Math.round(d.landedWell * 100)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-[11px] text-ink-soft">
                {Math.round(d.landedWell * 100)}% · {d.total}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Bar({ n, total, color }: { n: number; total: number; color: string }) {
  if (n <= 0) return null;
  return <div className="h-full" style={{ width: `${(n / total) * 100}%`, background: color }} />;
}

function Legend({ color, label, n }: { color: string; label: string; n: number }) {
  if (n <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      {label} <span className="text-ink-mid">{n}</span>
    </span>
  );
}
