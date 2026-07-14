import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { getSacredTree, getGardenHeader } from "@/lib/services/gardens";
import { NavBar } from "@/components/NavBar";
import { SacredTreeView } from "@/components/SacredTreeView";

export default async function SacredTreePage({
  params,
}: {
  params: { id: string };
}) {
  const viewer = await requireViewer();
  const [{ garden }, blooms] = await Promise.all([
    getGardenHeader(viewer.userId, params.id),
    getSacredTree(viewer.userId, params.id),
  ]);

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-5xl px-5 py-5">
        <div className="mb-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Link
              href={`/gardens/${garden.id}`}
              className="btn-ghost inline-flex min-w-0 max-w-[72%] items-center gap-1 px-3 py-1.5 text-xs"
            >
              <span aria-hidden>←</span>
              <span aria-hidden>{garden.emoji}</span>
              <span className="truncate">{garden.name}</span>
            </Link>
            <span className="shrink-0 whitespace-nowrap rounded-full border border-[rgba(76,175,80,0.25)] px-2.5 py-1 text-xs text-ink-soft">
              🌸 {blooms.length} Bloom{blooms.length === 1 ? "" : "s"}
            </span>
          </div>
          <h1 className="flex items-center gap-2 font-serif text-2xl text-ink">🌳 Sacred Tree</h1>
        </div>
        <SacredTreeView blooms={blooms} />
      </main>
    </div>
  );
}
