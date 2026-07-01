import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { listGardens } from "@/lib/services/gardens";
import { NavBar } from "@/components/NavBar";
import { CreateGardenForm } from "@/components/CreateGardenForm";
import { HashFocus } from "@/components/HashFocus";
import { FirstVisitIntro } from "@/components/FirstVisitIntro";
import { MorningQuote } from "@/components/MorningQuote";
import { WaitingForThem } from "@/components/WaitingForThem";

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
            <p className="eyebrow mb-2">Your gardens</p>
            <h1 className="serif-xl mb-8">What will the community grow today?</h1>
            <div className="mb-10 grid gap-4 sm:grid-cols-2">
              {gardens.map((g) => (
                <Link key={g.id} href={`/gardens/${g.id}`} className="card block p-5 transition hover:border-accent">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xl">{g.emoji}</span>
                    <span className="font-serif text-lg text-ink">{g.name}</span>
                  </div>
                  {g.description && (
                    <p className="mb-3 line-clamp-2 text-sm text-ink-mid">{g.description}</p>
                  )}
                  <div className="flex gap-4 text-xs text-ink-soft">
                    <span>🌱 {g.seedCount} seeds</span>
                    <span>🌸 {g.bloomCount} blooms</span>
                    <span>👥 {g.memberCount}</span>
                  </div>
                </Link>
              ))}
            </div>
            <div id="new-garden" className="card p-5">
              <p className="eyebrow mb-3">Plant a new garden</p>
              <CreateGardenForm />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
