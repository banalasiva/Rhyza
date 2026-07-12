import { Suspense } from "react";
import { requireViewer } from "@/lib/session";
import { listGardens } from "@/lib/services/gardens";
import { listPublicGardens } from "@/lib/services/explore";
import { getYourTurn } from "@/lib/services/yourturn";
import { db } from "@/lib/db";
import { NavBar } from "@/components/NavBar";
import { CreateGardenForm } from "@/components/CreateGardenForm";
import { GettingStarted } from "@/components/GettingStarted";
import { HashFocus } from "@/components/HashFocus";
import { FirstVisitIntro } from "@/components/FirstVisitIntro";
import { MorningQuote } from "@/components/MorningQuote";
import { DailyQuestion } from "@/components/DailyQuestion";
import { WaitingForThem } from "@/components/WaitingForThem";
import { PeopleToConnect } from "@/components/PeopleToConnect";
import { NotificationSetup } from "@/components/NotificationSetup";
import { PushHealer } from "@/components/PushHealer";
import { YourTurn } from "@/components/YourTurn";
import { DiscoverGardens } from "@/components/DiscoverGardens";
import { Feed } from "@/components/Feed";

// The home page streams: only requireViewer() (a fast JWT decode) blocks the
// first byte, so the shell + greeting paint almost immediately and the OS splash
// dismisses fast. Everything data-heavy — your gardens, "it's your turn", public
// gardens, the getting-started counts — resolves behind its own <Suspense> and
// flows in as it's ready, instead of holding the whole page hostage to ~9 DB
// queries on a cold serverless function.
export default async function GardensHome() {
  const viewer = await requireViewer();

  return (
    <div className="relative min-h-screen">
      <FirstVisitIntro />
      <HashFocus />
      <PushHealer />
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <MorningQuote name={viewer.name} />
        <DailyQuestion />
        <NotificationSetup />
        <Suspense fallback={null}>
          <PeopleToConnect userId={viewer.userId} />
        </Suspense>
        <Suspense fallback={null}>
          <YourTurnSection userId={viewer.userId} />
        </Suspense>
        <WaitingForThem />
        <Suspense fallback={<HomeSkeleton />}>
          <GardensArea userId={viewer.userId} orgId={viewer.orgId} name={viewer.name} />
        </Suspense>
      </main>
    </div>
  );
}

// The gardens/feed area — the one thing that decides first-run vs. the feed, so
// it awaits listGardens; but it's behind Suspense, so the shell already painted.
async function GardensArea({
  userId,
  orgId,
  name,
}: {
  userId: string;
  orgId: string;
  name?: string;
}) {
  const gardens = await listGardens(userId, orgId);

  if (gardens.length === 0) {
    return (
      <>
        <p className="eyebrow mb-2">Welcome{name ? `, ${name.split(" ")[0]}` : ""} 🌱</p>
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
        <Suspense fallback={null}>
          <DiscoverSection />
        </Suspense>
      </>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <GettingStartedSection userId={userId} firstGardenId={gardens[0]?.id} />
      </Suspense>
      <h1 className="serif-xl mb-4">What will the community grow today?</h1>
      {/* Start-something composer (also the target of the side panel's
          "New garden") — kept at the top, feed below, like a social home. */}
      <div id="new-garden" className="card mb-6 p-4">
        <p className="eyebrow mb-3">Plant a new garden</p>
        <CreateGardenForm />
      </div>
      {/* Public gardens to discover — collapsible, so it teaches without
          getting in the way of your own feed. */}
      <Suspense fallback={null}>
        <DiscoverSection />
      </Suspense>
      {/* The feed — an infinite, private-first river of seeds worth your
          thought. Your gardens live in the side panel. */}
      <Feed />
    </>
  );
}

// "It's your turn" — several queries; deferred so it never blocks first paint.
async function YourTurnSection({ userId }: { userId: string }) {
  const items = await getYourTurn(userId).catch(() => []);
  return <YourTurn items={items} />;
}

// Public gardens to discover — deferred so the world query doesn't gate the feed.
async function DiscoverSection() {
  const gardens = await listPublicGardens(12).catch(() => []);
  return <DiscoverGardens gardens={gardens} />;
}

// The getting-started progress — two cheap counts, still off the critical path.
async function GettingStartedSection({
  userId,
  firstGardenId,
}: {
  userId: string;
  firstGardenId?: string;
}) {
  const [seedCount, otherMembers] = await Promise.all([
    db.seed.count({ where: { deletedAt: null, createdById: userId } }),
    db.gardenMember.count({
      where: {
        userId: { not: userId },
        garden: { members: { some: { userId } } },
      },
    }),
  ]);
  return (
    <GettingStarted
      hasSeed={seedCount > 0}
      hasInvited={otherMembers > 0}
      firstGardenId={firstGardenId}
    />
  );
}

// A calm placeholder while the gardens area resolves — no spinner jank.
function HomeSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-8 w-2/3 rounded-lg bg-[rgba(255,255,255,0.05)]" />
      <div className="h-24 rounded-2xl bg-[rgba(255,255,255,0.04)]" />
      <div className="h-16 rounded-2xl bg-[rgba(255,255,255,0.03)]" />
    </div>
  );
}
