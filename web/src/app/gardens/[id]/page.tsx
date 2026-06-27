import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { getGardenDetail } from "@/lib/services/gardens";
import { NavBar } from "@/components/NavBar";
import { PlantSeedForm } from "@/components/PlantSeedForm";
import { InviteForm } from "@/components/InviteForm";
import { GardenSettings } from "@/components/GardenSettings";
import { STAGES } from "@/lib/constants";

function stageBadge(stage: string) {
  const s = STAGES.find((x) => x.key === stage) ?? STAGES[0];
  return `${s.emoji} ${s.label}`;
}

export default async function GardenPage({ params }: { params: { id: string } }) {
  const viewer = await requireViewer();
  const { garden, seeds, bloomed } = await getGardenDetail(viewer.userId, params.id);

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <Link href="/" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Your gardens
        </Link>
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow mb-1 flex items-center gap-2">
              <span>{garden.emoji} Garden</span>
              <span className="rounded-full border border-[rgba(255,255,255,0.1)] px-2 py-0.5 text-[10px] font-normal tracking-normal text-ink-soft">
                {garden.visibility === "private" ? "🔒 Private" : "🌍 Public"}
              </span>
            </p>
            <h1 className="serif-xl">{garden.name}</h1>
            {garden.description && (
              <p className="mt-1 text-sm text-ink-mid">{garden.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {garden.canManage && <GardenSettings garden={{ id: garden.id, name: garden.name, description: garden.description, emoji: garden.emoji, visibility: garden.visibility }} />}
            <Link href={`/gardens/${garden.id}/tree`} className="btn-ghost">
              🌸 Sacred Tree
            </Link>
          </div>
        </div>

        <div className="card mb-4 p-5">
          <p className="eyebrow mb-3">Plant a seed</p>
          <PlantSeedForm gardenId={garden.id} />
        </div>

        <div className="card mb-8 p-5">
          <p className="eyebrow mb-3">Invite people</p>
          <InviteForm gardenId={garden.id} />
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
                    <span className="flex items-center gap-2 font-serif text-lg text-ink">
                      {s.visibility === "private" && (
                        <span title="Private — only invited members" className="text-sm">🔒</span>
                      )}
                      {s.title}
                    </span>
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

        {bloomed.length > 0 && (
          <>
            <div className="mb-3 mt-8 flex items-center justify-between">
              <p className="eyebrow">🌸 Bloomed</p>
              <Link href={`/gardens/${garden.id}/tree`} className="text-xs text-ink-soft hover:text-ink">
                See the Sacred Tree →
              </Link>
            </div>
            <ul className="space-y-2">
              {bloomed.map((b) => (
                <li key={b.id}>
                  <Link
                    href={b.bloomId ? `/blooms/${b.bloomId}` : `/seeds/${b.id}`}
                    className="card block p-3 transition hover:border-accent"
                    style={{ borderColor: "rgba(255,179,0,0.25)" }}
                  >
                    <span className="flex items-center gap-2">
                      <span>🌸</span>
                      <span className="font-serif text-ink">{b.title}</span>
                      {b.visibility === "private" && <span title="Private" className="text-xs">🔒</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
