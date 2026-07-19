import Link from "next/link";
import { requireViewer } from "@/lib/session";
import {
  getReflectionSummary,
  lessonsInsight,
  listMyReflections,
} from "@/lib/services/reflections";
import { NavBar } from "@/components/NavBar";
import { DistributionBar } from "@/components/DistributionBar";

// Lessons you've drawn — its own place (kept separate from Judgement). The
// wisdom that compounds, plus how hard-won it's been. Private to the viewer.

const WEIGHT: Record<string, { label: string; color: string }> = {
  very_tough: { label: "Very tough", color: "#c62828" },
  tough: { label: "Tough", color: "#ef6c57" },
  medium: { label: "Medium", color: "#FFB300" },
  easy: { label: "Easy", color: "#9CCC65" },
  very_easy: { label: "Very easy", color: "#66BB6A" },
};
const OUTCOME: Record<string, { label: string; color: string }> = {
  better: { label: "turned out better", color: "#66BB6A" },
  expected: { label: "as expected", color: "#FFB300" },
  worse: { label: "turned out worse", color: "#e57373" },
};

export default async function LessonsPage() {
  const viewer = await requireViewer();
  const [summary, all] = await Promise.all([
    getReflectionSummary(viewer.userId).catch(() => null),
    listMyReflections(viewer.userId).catch(() => []),
  ]);
  const lessons = all.filter((d) => d.lesson);
  const weight = summary?.weight;
  const weightTotal = weight
    ? weight.very_tough + weight.tough + weight.medium + weight.easy + weight.very_easy
    : 0;

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/roots" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Your roots
        </Link>

        <div className="mb-6">
          <p className="eyebrow mb-1">💡 Lessons you&apos;ve drawn</p>
          <h1 className="serif-lg">What reality taught you</h1>
          <p className="mt-1 text-sm text-ink-mid">
            Decision by decision, the wisdom that compounds — and how hard-won it&apos;s been. Only
            you can see these.
          </p>
        </div>

        {lessons.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-mid">
            <div className="mb-1 text-2xl">💡</div>
            None yet. When a decision blooms, open it and note the biggest lesson — they gather here,
            one decision at a time.
          </div>
        ) : (
          <>
            {weightTotal > 0 && weight && (
              <div className="card space-y-4 p-5">
                {lessonsInsight(weight) && (
                  <p className="serif-lg leading-relaxed text-ink">{lessonsInsight(weight)}</p>
                )}
                <DistributionBar
                  title="How hard-won your lessons were"
                  segments={[
                    { n: weight.very_tough, color: "#c62828", label: "Very tough" },
                    { n: weight.tough, color: "#ef6c57", label: "Tough" },
                    { n: weight.medium, color: "#FFB300", label: "Medium" },
                    { n: weight.easy, color: "#9CCC65", label: "Easy" },
                    { n: weight.very_easy, color: "#66BB6A", label: "Very easy" },
                  ]}
                />
              </div>
            )}

            <div className="mt-6 space-y-2.5">
              {lessons.map((d) => (
                <Link
                  key={d.bloomId}
                  href={`/blooms/${d.bloomId}`}
                  className="card block p-4 transition hover:border-[rgba(255,179,0,0.4)]"
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    {d.lessonWeight && WEIGHT[d.lessonWeight] && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{
                          color: WEIGHT[d.lessonWeight].color,
                          background: `${WEIGHT[d.lessonWeight].color}1A`,
                        }}
                      >
                        {WEIGHT[d.lessonWeight].label}
                      </span>
                    )}
                    <span className="truncate text-[11px] text-ink-soft">{d.title}</span>
                    {d.outcome && OUTCOME[d.outcome] && (
                      <span className="text-[10px]" style={{ color: OUTCOME[d.outcome].color }}>
                        · {OUTCOME[d.outcome].label}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-line text-sm text-ink">💡 {d.lesson}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
