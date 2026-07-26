import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { lessonsInsight, listMyReflections } from "@/lib/services/reflections";
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
  const all = await listMyReflections(viewer.userId).catch(() => []);
  const lessons = all.filter((d) => d.lesson);
  // Derive the "how hard to learn" split straight from the lessons shown on this
  // page, so the bar can never disagree with the cards below it. Only lessons the
  // person actually rated for difficulty are counted — most people leave it blank,
  // so the caption spells out how many of their lessons this covers.
  const rated = lessons.filter((d) => d.lessonWeight && d.lessonWeight in WEIGHT);
  const weight = {
    very_tough: rated.filter((d) => d.lessonWeight === "very_tough").length,
    tough: rated.filter((d) => d.lessonWeight === "tough").length,
    medium: rated.filter((d) => d.lessonWeight === "medium").length,
    easy: rated.filter((d) => d.lessonWeight === "easy").length,
    very_easy: rated.filter((d) => d.lessonWeight === "very_easy").length,
  };
  const weightTotal = rated.length;

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/roots" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Your roots
        </Link>

        <div className="mb-6">
          <p className="eyebrow mb-1">💡 What you&apos;ve learned</p>
          <h1 className="serif-lg">Lessons from your decisions</h1>
          <p className="mt-1 text-sm text-ink-mid">
            What each decision taught you, and how hard it was to learn. Only you can see this.
          </p>
        </div>

        {lessons.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-mid">
            <div className="mb-1 text-2xl">💡</div>
            Nothing here yet. When a decision blooms, open it and jot down what you learned. Your
            lessons collect here, one at a time.
          </div>
        ) : (
          <>
            {weightTotal > 0 && weight && (
              <div className="card space-y-4 p-5">
                {lessonsInsight(weight) && (
                  <p className="serif-lg leading-relaxed text-ink">{lessonsInsight(weight)}</p>
                )}
                <DistributionBar
                  title="How hard these were to learn"
                  segments={[
                    { n: weight.very_tough, color: "#c62828", label: "Very tough" },
                    { n: weight.tough, color: "#ef6c57", label: "Tough" },
                    { n: weight.medium, color: "#FFB300", label: "Medium" },
                    { n: weight.easy, color: "#9CCC65", label: "Easy" },
                    { n: weight.very_easy, color: "#66BB6A", label: "Very easy" },
                  ]}
                />
                {weightTotal < lessons.length && (
                  <p className="text-[11px] text-ink-soft">
                    Based on the {weightTotal} of your {lessons.length} lessons you&apos;ve rated for
                    difficulty — rate the rest whenever you look back on them.
                  </p>
                )}
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
