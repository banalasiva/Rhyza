import { requireViewer } from "@/lib/session";
import { listGardens } from "@/lib/services/gardens";
import { listPublicGardens } from "@/lib/services/explore";
import { db } from "@/lib/db";
import { NavBar } from "@/components/NavBar";
import { CreateGardenForm } from "@/components/CreateGardenForm";
import { GettingStarted } from "@/components/GettingStarted";
import { HashFocus } from "@/components/HashFocus";
import { FirstVisitIntro } from "@/components/FirstVisitIntro";
import { MorningQuote } from "@/components/MorningQuote";
import { WaitingForThem } from "@/components/WaitingForThem";
import { EnableNotifications } from "@/components/EnableNotifications";
import { DiscoverGardens } from "@/components/DiscoverGardens";
import { Feed } from "@/components/Feed";

export default async function GardensHome() {
  const viewer = await requireViewer();
  const [gardens, publicGardens] = await Promise.all([
    listGardens(viewer.userId, viewer.orgId),
    listPublicGardens(12).catch(() => []),
  ]);

  // Progress for the "getting started" guide: has the viewer planted a seed,
  // and has anyone else joined a garden they're in? (Cheap counts; only the
  // presence matters.)
  const [seedCount, otherMembers] = gardens.length
    ? await Promise.all([
        db.seed.count({ where: { deletedAt: null, createdById: viewer.userId } }),
        db.gardenMember.count({
          where: {
            userId: { not: viewer.userId },
            garden: { members: { some: { userId: viewer.userId } } },
          },
        }),
      ])
    : [0, 0];

  return (
    <div className="relative min-h-screen">
      <FirstVisitIntro />
      <HashFocus />
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <MorningQuote name={viewer.name} />
        <EnableNotifications />
        <WaitingForThem />
        {gardens.length === 0 ? (
          // First run: warm, personal, and one concrete next step.
          <>
            <p className="eyebrow mb-2">Welcome{viewer.name ? `, ${viewer.name.split(" ")[0]}` : ""} 🌱</p>
            <h1 className="serif-xl mb-3">Let&apos;s start your first garden.</h1>
            <p className="mb-4 max-w-xl text-ink-mid">
              A <span className="text-ink">garden</span> is a topic your group cares about — like{" "}
              <em className="text-ink">Home Furniture</em> or <em className="text-ink">Summer Plans</em>.
              Inside it, each <span className="text-ink">seed</span> is one real decision you think
              through together — <em>“which fan?”</em>, <em>“where do we go?”</em>
            </p>
            <div className="mb-8 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(76,175,80,0.25)] px-3 py-1 text-ink-mid">
                🌳 Garden = a topic
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(76,175,80,0.25)] px-3 py-1 text-ink-mid">
                🌱 Seed = a decision
              </span>
            </div>
            <div id="new-garden" className="card p-5">
              <CreateGardenForm firstRun />
            </div>
            <p className="mb-8 mt-4 text-sm text-ink-soft">
              Just want to look around first?{" "}
              <a href="/explore" className="text-accent hover:underline">Explore public gardens →</a>
            </p>
            <DiscoverGardens gardens={publicGardens} />
          </>
        ) : (
          <>
            <GettingStarted
              hasSeed={seedCount > 0}
              hasInvited={otherMembers > 0}
              firstGardenId={gardens[0]?.id}
            />
            <h1 className="serif-xl mb-4">What will the community grow today?</h1>
            {/* Start-something composer (also the target of the side panel's
                "New garden") — kept at the top, feed below, like a social home. */}
            <div id="new-garden" className="card mb-6 p-4">
              <p className="eyebrow mb-3">Plant a new garden</p>
              <CreateGardenForm />
            </div>
            {/* Public gardens to discover — collapsible, so it teaches without
                getting in the way of your own feed. */}
            <DiscoverGardens gardens={publicGardens} />
            {/* The feed — an infinite, private-first river of seeds worth your
                thought. Your gardens live in the side panel. */}
            <Feed />
          </>
        )}
      </main>
    </div>
  );
}
