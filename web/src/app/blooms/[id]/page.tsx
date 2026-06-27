import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { getBloomDetail } from "@/lib/services/blooms";
import { NavBar } from "@/components/NavBar";
import { BloomBody } from "@/components/BloomBody";
import { RevertBloom } from "@/components/RevertBloom";

export default async function BloomPage({ params }: { params: { id: string } }) {
  const viewer = await requireViewer();
  const bloom = await getBloomDetail(viewer.userId, params.id);

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main className="relative z-10 mx-auto max-w-2xl px-6 py-8">
        <Link
          href={`/gardens/${bloom.garden.id}/tree`}
          className="btn-ghost inline-flex px-3 py-1.5 text-xs"
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

        <section className="mt-6">
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
