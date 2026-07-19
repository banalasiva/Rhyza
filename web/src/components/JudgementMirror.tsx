import type { ReflectionSummary } from "@/lib/services/reflections";
import { DistributionBar } from "@/components/DistributionBar";

// The judgement mirror — an insight sentence over two distributions: how a
// person's calls landed, and whether they'd stand by them. A mirror, never a
// score. Lessons (and how hard-won they were) live in their OWN section, so this
// stays purely about DECISIONS. Shared by the profile preview and the Judgement
// page. Presentational + server-safe.
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
      <DistributionBar
        title="How they turned out"
        segments={[
          { n: summary.outcome.better, color: "#66BB6A", label: "Better than expected" },
          { n: summary.outcome.expected, color: "#FFB300", label: "About as expected" },
          { n: summary.outcome.worse, color: "#e57373", label: "Worse than expected" },
        ]}
      />
      <DistributionBar
        title="Would you decide the same again?"
        segments={[
          { n: summary.sameAgain.yes, color: "#66BB6A", label: "Yes" },
          { n: summary.sameAgain.unsure, color: "#8A94A6", label: "Not sure" },
          { n: summary.sameAgain.no, color: "#e57373", label: "No" },
        ]}
      />
    </div>
  );
}
