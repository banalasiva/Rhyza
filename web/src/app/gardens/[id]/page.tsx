import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { getGardenDetail } from "@/lib/services/gardens";
import { NavBar } from "@/components/NavBar";
import { PlantSeedForm } from "@/components/PlantSeedForm";
import { STAGES } from "@/lib/constants";

function stageBadge(stage: string) {
  const s = STAGES.find((x) => x.key === stage) ?? STAGES[0];
  return `${s.emoji} ${s.label}`;
}

export default async function GardenPage({ params }: { params: { id: string } }) {
  const viewer = await requireViewer();
  const { garden, seeds } = await getGardenDetail(viewer.userId, params.id);

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="eyebrow mb-1">{garden.emoji} Garden</p>
            <h1 className="serif-xl">{garden.name}</h1>
            {garden.description && (
              <p className="mt-1 text-sm text-ink-mid">{garden.description}</p>
            )}
          </div>
          <Link href={`/gardens/${garden.id}/tree`} className="btn-ghost shrink-0">
            🌸 Sacred Tree
          </Link>
        </div>

        <div className="card mb-8 p-5">
          <p className="eyebrow mb-3">Plant a seed</p>
          <PlantSeedForm gardenId={garden.id} />
        </div>

        <p className="eyebrow mb-3">Growing seeds</p>
        {seeds.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Nothing growing yet — plant the first question above.
          </p>
        ) : (
          <ul className="space-y-3">
            {seeds.map((s) => (
              <li key={s.id}>
                <Link href={`/seeds/${s.id}`} className="card block p-4 transition hover:border-accent">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="font-serif text-lg text-ink">{s.title}</span>
                    <span className="shrink-0 text-xs text-accent">{stageBadge(s.stage)}</span>
                  </div>
                  {s.content && (
                    <p className="line-clamp-2 text-sm text-ink-mid">{s.content}</p>
                  )}
                  <p className="mt-2 text-xs text-ink-soft">
                    {s.author?.name || "Someone"} · {s.contributionCount} contributions
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
