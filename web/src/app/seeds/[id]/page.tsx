import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { getSeedDetail } from "@/lib/services/seeds";
import { getReactionTypes } from "@/lib/registry";
import { NavBar } from "@/components/NavBar";
import { SeedRoom } from "@/components/SeedRoom";
import { SeedInvite } from "@/components/SeedInvite";

export default async function SeedPage({ params }: { params: { id: string } }) {
  const viewer = await requireViewer();
  const [seed, reactions] = await Promise.all([
    getSeedDetail(viewer.userId, params.id),
    getReactionTypes(),
  ]);

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-6">
        <div className="relative flex items-center justify-between gap-3">
          <Link
            href={`/gardens/${seed.garden.id}`}
            className="btn-ghost inline-flex px-3 py-1.5 text-xs"
          >
            ← {seed.garden.emoji} {seed.garden.name}
          </Link>
          <SeedInvite gardenId={seed.garden.id} gardenName={seed.garden.name} />
        </div>
        <SeedRoom
          seed={seed}
          reactions={reactions}
          currentUserId={viewer.userId}
        />
      </main>
    </div>
  );
}
