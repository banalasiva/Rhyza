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
import { MorningQuote } from "@/components/MorningQuote";
import { DailyQuestion } from "@/components/DailyQuestion";
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
      <HashFocus />
      <PushHealer />
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <MorningQuote name={viewer.name} />
        <DailyQuestion />
        <NotificationSetup />
        {/* "It's your turn" stays — it's things waiting on YOU to act on, part of
            consuming the feed. Creating (gardens/seeds) and "waiting for them"
            now live in the Plant tab, so Home is just seeds to read + weigh in. */}
        <Suspense fallback={null}>
          <YourTurnSection userId={viewer.userId} />
        </Suspense>
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
    // First run: don't hit them with a wall of text or a dead "make a garden"
    // form. Drop them straight into real public decisions so they get a feel for
    // it in seconds — the "just show public gardens so they get a hang" ask.
    // Starting your own sits quietly below, once they've seen the point.
    return (
      <>
        <p className="eyebrow mb-2">Welcome{name ? `, ${name.split(" ")[0]}` : ""} 🌱</p>
        <h1 className="serif-lg mb-4">See how people are deciding together 👇</h1>
        <Suspense fallback={null}>
          <DiscoverSection />
        </Suspense>
        <Feed />

        <div id="new-garden" className="card mt-8 p-4">
          <p className="mb-1 text-sm font-medium text-ink">Ready to decide something of your own?</p>
          <p className="mb-3 text-xs text-ink-soft">🌳 a garden is a topic · 🌱 a seed is one decision</p>
          <CreateGardenForm firstRun />
        </div>
      </>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <GettingStartedSection userId={userId} firstGardenId={gardens[0]?.id} />
      </Suspense>
      {/* Home is for consuming — seeds to read and weigh in on. Creating a
          garden or seed now lives in the Plant tab. Public gardens to discover
          stay (collapsible), then the feed. */}
      <Suspense fallback={null}>
        <DiscoverSection />
      </Suspense>
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
