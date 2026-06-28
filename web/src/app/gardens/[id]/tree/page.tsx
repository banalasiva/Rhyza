import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { getSacredTree, getGardenDetail } from "@/lib/services/gardens";
import { NavBar } from "@/components/NavBar";
import { SacredTreeView } from "@/components/SacredTreeView";

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
      <main id="main" className="relative z-10 mx-auto max-w-5xl px-5 py-5">
        <div className="mb-4 flex items-center justify-between">
          <Link href={`/gardens/${garden.id}`} className="btn-ghost px-3 py-1.5 text-xs">
            ← {garden.emoji} {garden.name}
          </Link>
          <span className="font-serif text-lg text-ink">🌳 Sacred Tree</span>
          <span className="text-xs text-ink-soft">{blooms.length} Bloom{blooms.length === 1 ? "" : "s"}</span>
        </div>
        <SacredTreeView blooms={blooms} />
      </main>
    </div>
  );
}
