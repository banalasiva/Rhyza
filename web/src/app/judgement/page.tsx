import Link from "next/link";
import { requireViewer } from "@/lib/session";
import {
  getReflectionSummary,
  getReflectionsByArea,
  judgementInsight,
  listMyReflections,
} from "@/lib/services/reflections";
import { NavBar } from "@/components/NavBar";
import { JudgementMirror } from "@/components/JudgementMirror";

// A mirror, never a score: how a person's decisions have actually landed, and
// whether they'd stand by them — the heart of ThinkThru. Private to the viewer.

const OUTCOME: Record<string, { label: string; color: string }> = {
  better: { label: "Turned out better", color: "#66BB6A" },
  expected: { label: "About as expected", color: "#FFB300" },
  worse: { label: "Turned out worse", color: "#e57373" },
};
const SAME: Record<string, { label: string; color: string }> = {
  definitely_yes: { label: "Same again: definitely", color: "#66BB6A" },
  probably_yes: { label: "Same again: probably", color: "#66BB6A" },
  not_sure: { label: "Same again: not sure", color: "#8A94A6" },
  probably_no: { label: "Would redo: probably", color: "#e57373" },
  definitely_no: { label: "Would redo: definitely", color: "#e57373" },
};
const WEIGHT: Record<string, { label: string; color: string }> = {
  very_tough: { label: "Very tough lesson", color: "#c62828" },
  tough: { label: "Tough lesson", color: "#ef6c57" },
  medium: { label: "Medium lesson", color: "#FFB300" },
  easy: { label: "Easy lesson", color: "#9CCC65" },
  very_easy: { label: "Very easy lesson", color: "#66BB6A" },
};

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px]"
      style={{ color, background: `${color}1A` }}
    >
      {label}
    </span>
  );
}

export default async function JudgementPage() {
  const viewer = await requireViewer();
  const [summary, decisions, areas] = await Promise.all([
    getReflectionSummary(viewer.userId).catch(() => null),
    listMyReflections(viewer.userId).catch(() => []),
    getReflectionsByArea(viewer.userId).catch(() => []),
  ]);
  const insight = summary ? judgementInsight(summary) : null;
  const empty = !summary || summary.reflected === 0;

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/roots" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Your roots
        </Link>

        <div className="mb-6">
          <p className="eyebrow mb-1">🪞 Your judgement</p>
          <h1 className="serif-lg">Looking back on your decisions</h1>
          <p className="mt-1 text-sm text-ink-mid">
            How your calls actually turned out, and whether you&apos;d stand by them. A mirror to
            help you think better over time — not a score, and only you can see it.
          </p>
        </div>

        {empty ? (
          <div className="card p-6 text-center text-sm text-ink-mid">
            <div className="mb-1 text-2xl">🪞</div>
            Nothing to reflect on yet. When a decision blooms, open it and note how it turned out —
            over time, the pattern of your judgment shows up here.
          </div>
        ) : (
          <>
            <JudgementMirror summary={summary!} insight={insight} />

            {/* By area — one mirror per garden (Hiring, Product, Money…), so you
                can see where your judgment is strong and where it keeps
                surprising you. Only shown when there's more than one area. */}
            {areas.length > 1 && (
              <section className="mt-8">
                <p className="eyebrow mb-1">By area</p>
                <p className="mb-3 text-[11px] text-ink-soft">
                  Your calls tend to land differently in different parts of life.
                </p>
                <div className="space-y-5">
                  {areas.map((a) => (
                    <div key={a.gardenId}>
                      <p className="mb-2 text-sm text-ink">
                        <span aria-hidden>{a.emoji}</span> {a.name}
                        <span className="text-ink-soft">
                          {" "}
                          · {a.reflected} {a.reflected === 1 ? "decision" : "decisions"}
                        </span>
                      </p>
                      <JudgementMirror summary={a} insight={judgementInsight(a)} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8">
              <p className="eyebrow mb-3">Decision by decision</p>
              <div className="space-y-2.5">
                {decisions.map((d) => (
                  <Link
                    key={d.bloomId}
                    href={`/blooms/${d.bloomId}`}
                    className="card block p-4 transition hover:border-[rgba(255,179,0,0.4)]"
                  >
                    <p className="text-sm text-ink">{d.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {d.outcome && OUTCOME[d.outcome] && (
                        <Chip label={OUTCOME[d.outcome].label} color={OUTCOME[d.outcome].color} />
                      )}
                      {d.sameAgain && SAME[d.sameAgain] && (
                        <Chip label={SAME[d.sameAgain].label} color={SAME[d.sameAgain].color} />
                      )}
                      {d.lessonWeight && WEIGHT[d.lessonWeight] && (
                        <Chip
                          label={WEIGHT[d.lessonWeight].label}
                          color={WEIGHT[d.lessonWeight].color}
                        />
                      )}
                    </div>
                    {d.lesson && (
                      <p className="mt-2 text-xs text-ink-mid">💡 {d.lesson}</p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
