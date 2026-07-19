import Link from "next/link";
import { getViewer } from "@/lib/session";
import { getBloomForCalibration } from "@/lib/services/calibration";
import { BloomContent } from "@/components/BloomContent";
import { CalibrateForm } from "@/components/CalibrateForm";

// A single bloom, opened by anyone with the link — no seed access. They see the
// decision and say how it actually landed for them, calibrating the decider's
// self-read. The most personal possible invitation into ThinkThru.
export default async function CalibratePage({ params }: { params: { token: string } }) {
  const target = await getBloomForCalibration(params.token);
  const viewer = await getViewer();

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <main id="main" className="relative z-10 mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 text-center">
          <div className="mb-2 text-3xl">🌸</div>
          <p className="eyebrow" style={{ color: "#FFB300" }}>
            A decision, thought through
          </p>
        </div>

        {!target ? (
          <div className="card p-6 text-center text-sm text-ink-mid">
            <div className="mb-2 text-3xl">🍂</div>
            This link is no longer valid — the decision may have been reopened or removed.
          </div>
        ) : (
          <>
            <div className="mb-4 text-center">
              <h1 className="serif-lg mb-1">{target.title}</h1>
              <p className="text-xs text-ink-soft">
                {target.ownerName} decided this{target.gardenName ? ` · ${target.gardenName}` : ""} —
                and wants to know how it landed for you.
              </p>
            </div>

            {/* Here's the decision and the reasoning behind it — enough context to
                give an honest read, without opening the whole private discussion. */}
            <p className="mb-2 text-center text-[11px] uppercase tracking-wide text-ink-soft">
              What they decided, and why
            </p>
            <article className="card mb-5 p-5 text-[15px] leading-relaxed text-ink">
              <BloomContent text={target.summary} />
            </article>

            <p className="mx-auto mb-6 max-w-sm text-center text-xs text-ink-mid">
              You&apos;re not grading the decision — just sharing how it{" "}
              <span className="text-ink">actually turned out for you</span>. Your lived experience
              is the context; no backstory needed.
            </p>

            {viewer ? (
              <CalibrateForm token={params.token} ownerName={target.ownerName} />
            ) : (
              <div className="card p-6 text-center">
                <p className="mb-1 text-sm font-medium text-ink">
                  Add your honest read of how it turned out
                </p>
                <p className="mb-4 text-xs text-ink-mid">
                  {target.ownerName} will see it next to their own — it&apos;s how they calibrate
                  their judgment. Sign in (it takes seconds) to add yours.
                </p>
                <Link
                  href={`/login?next=${encodeURIComponent(`/calibrate/${params.token}`)}`}
                  className="btn-primary inline-flex"
                >
                  Sign in to weigh in
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
