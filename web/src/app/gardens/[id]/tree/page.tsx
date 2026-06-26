import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { getSacredTree, getGardenDetail } from "@/lib/services/gardens";
import { NavBar } from "@/components/NavBar";

export default async function SacredTreePage({
  params,
}: {
  params: { id: string };
}) {
  const viewer = await requireViewer();
  const [{ garden }, blooms] = await Promise.all([
    getGardenDetail(viewer.userId, params.id),
    getSacredTree(viewer.userId, params.id),
  ]);

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <Link href={`/gardens/${garden.id}`} className="text-xs text-ink-soft hover:text-ink">
          ← {garden.emoji} {garden.name}
        </Link>
        <div className="my-6 text-center">
          <div className="mb-2 text-4xl">🌳</div>
          <h1 className="serif-xl">The Sacred Tree</h1>
          <p className="mt-1 text-sm text-ink-mid">
            Every idea this community has grown to bloom. Durable knowledge, remembered forever.
          </p>
        </div>

        {blooms.length === 0 ? (
          <p className="text-center text-sm text-ink-soft">
            No blooms yet. When a seed reaches the bloom threshold, it lands here.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {blooms.map((b) => (
              <Link key={b.id} href={`/blooms/${b.id}`} className="card block p-5 transition hover:border-accent">
                <div className="mb-2 text-2xl">🌸</div>
                <p className="mb-1 font-serif text-lg text-ink">{b.title}</p>
                <p className="line-clamp-3 text-sm text-ink-mid">{b.summary}</p>
                <p className="mt-3 text-xs text-ink-soft">
                  v{b.version} · {b.contributors.length} contributors
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
