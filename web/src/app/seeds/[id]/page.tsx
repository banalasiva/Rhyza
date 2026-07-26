import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { db } from "@/lib/db";
import {
  getSeedDetail,
  getSeedPreview,
  getPublicSeedForGuest,
  getDeletedSeedNote,
} from "@/lib/services/seeds";
import { getReactionTypes } from "@/lib/registry";
import { NavBar } from "@/components/NavBar";
import { GuestTopBar } from "@/components/GuestTopBar";
import { SeedRoom } from "@/components/SeedRoom";
import { SeedRhythm } from "@/components/SeedRhythm";
import { LockedSeed } from "@/components/LockedSeed";
import { GuestSeedView } from "@/components/GuestSeedView";

export default async function SeedPage({ params }: { params: { id: string } }) {
  const viewer = await getViewer();

  // Signed-out guest: public seeds "just work" as a read-only page (anyone with
  // the link can read the question + conversation). Anything private, or any
  // interaction, routes through sign-in — so a guest can never write or trigger
  // a paid AI call.
  if (!viewer) {
    const guest = await getPublicSeedForGuest(params.id);
    if (!guest) redirect(`/login?next=${encodeURIComponent(`/seeds/${params.id}`)}`);
    const reactions = await getReactionTypes();
    const reactionEmoji = Object.fromEntries(reactions.map((r) => [r.key, r.emoji]));
    return (
      <div className="relative min-h-screen">
        <div className="garden-bg" />
        <GuestTopBar next={`/seeds/${params.id}`} />
        <main id="main" className="relative z-10 px-4 py-5 sm:px-6 sm:py-6">
          <GuestSeedView seed={guest} reactionEmoji={reactionEmoji} />
        </main>
      </div>
    );
  }

  // Try to open the seed. If access is denied (a private seed they're not in
  // yet — e.g. they arrived via a shared link), fall back to the locked preview
  // where they can request to join, instead of a dead 404.
  let seed: Awaited<ReturnType<typeof getSeedDetail>> | null = null;
  try {
    seed = await getSeedDetail(viewer.userId, params.id);
  } catch {
    // A private seed they can still knock on → the locked "request to join" view.
    const preview = await getSeedPreview(viewer.userId, params.id);
    if (preview) {
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
    // A seed that was deleted (its row lingers, soft-deleted) → a warm note
    // instead of a bare 404, so a link/notification to a removed seed lands
    // gently. A truly-unknown id still falls through to notFound().
    const gone = await getDeletedSeedNote(params.id);
    if (!gone) notFound();
    return (
      <div className="relative min-h-screen">
        <div className="garden-bg" />
        <NavBar name={viewer.name} />
        <main id="main" className="relative z-10 mx-auto max-w-md px-6 py-16 text-center">
          <div className="mb-2 text-4xl">🥀</div>
          <h1 className="serif-lg mb-2">This seed was removed</h1>
          <p className="mb-5 text-sm text-ink-mid">
            Whoever planted it chose to take it down. Its thread is gone, but every
            other seed in your gardens is still growing.
          </p>
          <Link href="/" className="btn-primary">
            Back to your gardens
          </Link>
        </main>
      </div>
    );
  }

  // Opening a seed you'd hidden from Home brings it back — actively opening it
  // is clear interest, so clear any dismissal. Best-effort, in parallel so it
  // never adds latency (and a missing table never breaks the page).
  const [reactions] = await Promise.all([
    getReactionTypes(),
    db.seedDismissal
      .deleteMany({ where: { userId: viewer.userId, seedId: params.id } })
      .catch(() => undefined),
  ]);

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
        <SeedRhythm
          seedId={seed.id}
          canManage={seed.canManage}
          active={!seed.bloomId}
          young={seed.contributions.length <= 2}
        />
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
