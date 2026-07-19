import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { getBloomDetail } from "@/lib/services/blooms";
import { NavBar } from "@/components/NavBar";
import { BloomBody } from "@/components/BloomBody";
import { BloomReflection } from "@/components/BloomReflection";
import { CalibrateInvite } from "@/components/CalibrateInvite";
import { getCalibrations } from "@/lib/services/calibration";
import { RevertBloom } from "@/components/RevertBloom";

const OUTCOME_LABEL: Record<string, { label: string; color: string }> = {
  better: { label: "Better than expected", color: "#66BB6A" },
  expected: { label: "About as expected", color: "#FFB300" },
  worse: { label: "Worse than expected", color: "#e57373" },
};
const SAME_LABEL: Record<string, string> = {
  definitely_yes: "Same again: definitely",
  probably_yes: "Same again: probably",
  not_sure: "Same again: not sure",
  probably_no: "Would redo: probably",
  definitely_no: "Would redo: definitely",
};

export default async function BloomPage({ params }: { params: { id: string } }) {
  const viewer = await requireViewer();

  // The bloom may have been reverted (deleted) since a notification/link was
  // created — show a friendly note instead of an error page.
  let bloom;
  try {
    bloom = await getBloomDetail(viewer.userId, params.id);
  } catch {
    return (
      <div className="relative min-h-screen">
        <div className="garden-bg" />
        <NavBar name={viewer.name} />
        <main id="main" className="relative z-10 mx-auto max-w-md px-6 py-16 text-center">
          <div className="mb-2 text-4xl">🍂</div>
          <h1 className="serif-lg mb-2">This bloom is no longer here</h1>
          <p className="mb-5 text-sm text-ink-mid">
            It may have been reopened to evolve, or reverted. The conversation lives
            on in its garden.
          </p>
          <Link href="/" className="btn-primary">
            Back to your gardens
          </Link>
        </main>
      </div>
    );
  }

  // Reality's outside voice — how the decision landed for the people it touched.
  const calibrations = await getCalibrations(bloom.id, viewer.userId).catch(() => []);
  const others = calibrations.filter((c) => !c.mine);

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href={`/gardens/${bloom.garden.id}/tree`}
          className="btn-ghost no-print inline-flex px-3 py-1.5 text-xs"
        >
          ← 🌸 Sacred Tree
        </Link>

        <div className="mt-4 text-center">
          <div className="mb-2 text-5xl">🌸</div>
          <p className="eyebrow mb-2" style={{ color: "#FFB300" }}>
            Bloomed knowledge · v{bloom.version}
          </p>
        </div>

        <BloomBody
          id={bloom.id}
          initialTitle={bloom.title}
          initialSummary={bloom.summary}
          aiSynthesized={bloom.aiSynthesized}
        />

        {/* Links shared while deciding — the references (docs, quotes, videos)
            that shaped the call, carried into the bloom. */}
        {bloom.links.length > 0 && (
          <section className="mt-6">
            <p className="eyebrow mb-3">🔗 Links shared</p>
            <div className="space-y-2">
              {bloom.links.map((l, i) => {
                let host = l.url;
                try {
                  host = new URL(l.url).hostname.replace(/^www\./, "");
                } catch {
                  /* keep raw */
                }
                return (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="card flex items-center gap-3 p-3 transition hover:border-accent"
                  >
                    <span aria-hidden>🔗</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{host}</span>
                      <span className="block truncate text-[11px] text-ink-soft">{l.url}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-ink-soft">{l.by}</span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Bloom 2.0 — the decision keeps growing until reality teaches us
            something. A private, revisitable reflection; each part can be shared. */}
        <BloomReflection
          bloomId={bloom.id}
          initial={bloom.reflection}
          seedPrivate={bloom.seedPrivate}
          shared={bloom.sharedReflections}
        />

        {/* Calibration — reality's outside voice. Ask the people the decision
            affected how it actually landed, and hold it against your own read. */}
        <section className="mt-8">
          <div className="mb-3">
            <p className="eyebrow">How it landed for others</p>
            <p className="mt-1 text-xs text-ink">
              Your self-read is one voice. Ask the people it touched for theirs — that&apos;s how
              judgment sharpens.
            </p>
            <div className="mt-3">
              <CalibrateInvite bloomId={bloom.id} />
            </div>
          </div>
          {others.length === 0 ? (
            <div className="card p-4 text-center text-xs text-ink-soft">
              No outside reads yet. Tap <span className="text-ink">Ask how it landed</span> and send
              the link to whoever this decision affected.
            </div>
          ) : (
            <div className="space-y-2.5">
              {others.map((c, i) => (
                <div key={i} className="card p-4">
                  <p className="mb-1.5 text-sm font-medium text-accent">{c.name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {c.outcome && OUTCOME_LABEL[c.outcome] && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{
                          color: OUTCOME_LABEL[c.outcome].color,
                          background: `${OUTCOME_LABEL[c.outcome].color}1A`,
                        }}
                      >
                        {OUTCOME_LABEL[c.outcome].label}
                      </span>
                    )}
                    {c.sameAgain && SAME_LABEL[c.sameAgain] && (
                      <span className="text-[10px] text-ink-soft">· {SAME_LABEL[c.sameAgain]}</span>
                    )}
                  </div>
                  {c.note && <p className="mt-2 text-sm text-ink-mid">{c.note}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <p className="eyebrow mb-3">Lineage — who grew this</p>
          <ul className="space-y-2">
            {bloom.contributors.map((c, i) => (
              <li key={i} className="card flex items-center justify-between p-3">
                <span className="text-sm text-ink">{c.name || "A contributor"}</span>
                <span className="text-xs text-ink-soft">{c.role}</span>
              </li>
            ))}
          </ul>
        </section>

        {bloom.versions.length > 1 && (
          <section className="mt-6">
            <p className="eyebrow mb-2">Versions</p>
            <div className="flex flex-wrap gap-2">
              {bloom.versions.map((v) => (
                <Link
                  key={v.id}
                  href={`/blooms/${v.id}`}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    v.id === bloom.id ? "border-accent text-accent" : "text-ink-mid"
                  }`}
                >
                  v{v.version}
                </Link>
              ))}
            </div>
          </section>
        )}

        {bloom.canRevert && <RevertBloom seedId={bloom.seed.id} version={bloom.version} />}
      </main>
    </div>
  );
}
