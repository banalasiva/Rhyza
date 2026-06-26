import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { listGardens } from "@/lib/services/gardens";
import { NavBar } from "@/components/NavBar";
import { CreateGardenForm } from "@/components/CreateGardenForm";

export default async function GardensHome() {
  const viewer = await requireViewer();
  const gardens = await listGardens(viewer.userId, viewer.orgId);

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main className="relative z-10 mx-auto max-w-4xl px-6 py-8">
        <p className="eyebrow mb-2">Your gardens</p>
        <h1 className="serif-xl mb-8">What will the community grow today?</h1>

        {gardens.length === 0 ? (
          <div className="card mb-8 p-8 text-center">
            <div className="mb-2 text-3xl">🌿</div>
            <p className="text-ink-mid">
              No gardens yet. Plant the first one below.
            </p>
          </div>
        ) : (
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
        )}

        <div className="card p-5">
          <p className="eyebrow mb-3">Plant a new garden</p>
          <CreateGardenForm />
        </div>
      </main>
    </div>
  );
}
