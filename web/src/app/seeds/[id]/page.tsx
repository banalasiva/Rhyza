import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getSeedDetail, getSeedPreview } from "@/lib/services/seeds";
import { getReactionTypes } from "@/lib/registry";
import { NavBar } from "@/components/NavBar";
import { SeedRoom } from "@/components/SeedRoom";
import { LockedSeed } from "@/components/LockedSeed";

export default async function SeedPage({ params }: { params: { id: string } }) {
  const viewer = await requireViewer();

  // Try to open the seed. If access is denied (a private seed they're not in
  // yet — e.g. they arrived via a shared link), fall back to the locked preview
  // where they can request to join, instead of a dead 404.
  let seed: Awaited<ReturnType<typeof getSeedDetail>> | null = null;
  try {
    seed = await getSeedDetail(viewer.userId, params.id);
  } catch {
    const preview = await getSeedPreview(viewer.userId, params.id);
    if (!preview) notFound();
    return (
      <div className="relative min-h-screen">
        <div className="garden-bg" />
        <NavBar name={viewer.name} />
        <main id="main" className="relative z-10 mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
          <LockedSeed preview={preview} />
        </main>
      </div>
    );
  }

  const reactions = await getReactionTypes();

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="relative flex items-center gap-3">
          <Link
            href={`/gardens/${seed.garden.id}`}
            className="btn-ghost inline-flex px-3 py-1.5 text-xs"
          >
            ← {seed.garden.emoji} {seed.garden.name}
          </Link>
        </div>
        <SeedRoom
          seed={seed}
          reactions={reactions}
          currentUserId={viewer.userId}
          uploadsEnabled={!!process.env.BLOB_READ_WRITE_TOKEN}
        />
      </main>
    </div>
  );
}
