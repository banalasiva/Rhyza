import type { ReflectionSummary } from "@/lib/services/reflections";

// The judgement mirror — an insight sentence over two proportional bars. A
// mirror, never a score: it shows the SHAPE of how a person's calls land and
// whether they'd stand by them. Shared by the profile preview and the dedicated
// Judgement page. Presentational + server-safe.

function Bar({
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

export function JudgementMirror({
  summary,
  insight,
}: {
  summary: ReflectionSummary;
  insight: string | null;
}) {
  return (
    <div className="card space-y-5 p-5">
      {insight && <p className="serif-lg leading-relaxed text-ink">{insight}</p>}
      <Bar
        title="How they turned out"
        segments={[
          { n: summary.outcome.better, color: "#66BB6A", label: "Better than expected" },
          { n: summary.outcome.expected, color: "#FFB300", label: "About as expected" },
          { n: summary.outcome.worse, color: "#e57373", label: "Worse than expected" },
        ]}
      />
      <Bar
        title="Would you decide the same again?"
        segments={[
          { n: summary.sameAgain.yes, color: "#66BB6A", label: "Yes" },
          { n: summary.sameAgain.unsure, color: "#8A94A6", label: "Not sure" },
          { n: summary.sameAgain.no, color: "#e57373", label: "No" },
        ]}
      />
      {summary.weight.very_tough +
        summary.weight.tough +
        summary.weight.medium +
        summary.weight.easy +
        summary.weight.very_easy >
        0 && (
        <Bar
          title="How hard-won your lessons were"
          segments={[
            { n: summary.weight.very_tough, color: "#c62828", label: "Very tough" },
            { n: summary.weight.tough, color: "#ef6c57", label: "Tough" },
            { n: summary.weight.medium, color: "#FFB300", label: "Medium" },
            { n: summary.weight.easy, color: "#9CCC65", label: "Easy" },
            { n: summary.weight.very_easy, color: "#66BB6A", label: "Very easy" },
          ]}
        />
      )}
    </div>
  );
}
