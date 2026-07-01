import { requireViewer } from "@/lib/session";
import { listGardens } from "@/lib/services/gardens";
import { NavBar } from "@/components/NavBar";
import { CreateGardenForm } from "@/components/CreateGardenForm";
import { HashFocus } from "@/components/HashFocus";
import { FirstVisitIntro } from "@/components/FirstVisitIntro";
import { MorningQuote } from "@/components/MorningQuote";
import { WaitingForThem } from "@/components/WaitingForThem";
import { Feed } from "@/components/Feed";

export default async function GardensHome() {
  const viewer = await requireViewer();
  const gardens = await listGardens(viewer.userId, viewer.orgId);

  return (
    <div className="relative min-h-screen">
      <FirstVisitIntro />
      <HashFocus />
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <MorningQuote name={viewer.name} />
        <WaitingForThem />
        {gardens.length === 0 ? (
          // First run: warm, personal, and one concrete next step.
          <>
            <p className="eyebrow mb-2">Welcome{viewer.name ? `, ${viewer.name.split(" ")[0]}` : ""} 🌱</p>
            <h1 className="serif-xl mb-3">Let&apos;s start your first garden.</h1>
            <p className="mb-8 max-w-xl text-ink-mid">
              A <span className="text-ink">garden</span> is a space for a group — your family,
              your friends, your team — to think a decision through together. Name yours, then
              plant your first question inside it.
            </p>
            <div id="new-garden" className="card p-5">
              <CreateGardenForm firstRun />
            </div>
          </>
        ) : (
          <>
            <h1 className="serif-xl mb-4">What will the community grow today?</h1>
            {/* Start-something composer (also the target of the side panel's
                "New garden") — kept at the top, feed below, like a social home. */}
            <div id="new-garden" className="card mb-6 p-4">
              <p className="eyebrow mb-3">Plant a new garden</p>
              <CreateGardenForm />
            </div>
            {/* The feed — an infinite, private-first river of seeds worth your
                thought. Your gardens live in the side panel. */}
            <Feed />
          </>
        )}
      </main>
    </div>
  );
}
