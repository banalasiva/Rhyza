import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { getSeedDetail } from "@/lib/services/seeds";
import { db } from "@/lib/db";
import { NavBar } from "@/components/NavBar";
import { SeedRoom } from "@/components/SeedRoom";

export default async function SeedPage({ params }: { params: { id: string } }) {
  const viewer = await requireViewer();
  const seed = await getSeedDetail(viewer.userId, params.id);
  const reactions = await db.reactionType.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { key: true, emoji: true, label: true },
  });

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-6">
        <Link
          href={`/gardens/${seed.garden.id}`}
          className="btn-ghost inline-flex px-3 py-1.5 text-xs"
        >
          ← {seed.garden.emoji} {seed.garden.name}
        </Link>
        <SeedRoom
          seed={seed}
          reactions={reactions}
          currentUserId={viewer.userId}
        />
      </main>
    </div>
  );
}
