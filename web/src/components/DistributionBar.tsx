// A single proportional distribution: a thin bar + a legend with counts. Shows
// the SHAPE of a set of answers (a mirror), never a headline number/score.
// Shared by the Judgement and Lessons mirrors. Presentational + server-safe.
export function DistributionBar({
  title,
  segments,
}: {
  title: string;
  segments: { n: number; color: string; label: string }[];
}) {
  const total = segments.reduce((s, x) => s + x.n, 0);
  return (
    <div>
      <p className="mb-2 text-xs text-ink-mid">{title}</p>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        {total > 0 &&
          segments.map((s, i) =>
            s.n > 0 ? (
              <div key={i} style={{ width: `${(s.n / total) * 100}%`, background: s.color }} />
            ) : null,
          )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-[11px] text-ink-mid">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            {s.label} · <span className="text-ink">{s.n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
