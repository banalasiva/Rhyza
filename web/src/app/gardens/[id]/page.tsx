import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { getGardenDetail } from "@/lib/services/gardens";
import { NavBar } from "@/components/NavBar";
import { PlantSeedForm } from "@/components/PlantSeedForm";
import { InviteForm } from "@/components/InviteForm";
import { GardenSettings } from "@/components/GardenSettings";
import { HashFocus } from "@/components/HashFocus";
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
      <HashFocus />
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Your gardens
        </Link>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow mb-1 flex flex-wrap items-center gap-2">
              <span>{garden.emoji} Garden</span>
              <span className="rounded-full border border-[rgba(255,255,255,0.1)] px-2 py-0.5 text-[10px] font-normal tracking-normal text-ink-soft">
                {garden.visibility === "private" ? "🔒 Private" : "🌍 Public"}
              </span>
            </p>
            <h1 className="serif-xl break-words">{garden.name}</h1>
            {garden.description && (
              <p className="mt-1 text-sm text-ink-mid">{garden.description}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {garden.canManage && <GardenSettings garden={{ id: garden.id, name: garden.name, description: garden.description, emoji: garden.emoji, visibility: garden.visibility }} />}
            <Link href={`/gardens/${garden.id}/tree`} className="btn-ghost">
              🌸 Sacred Tree
            </Link>
          </div>
        </div>

        {/* Lead with the living content — people consume before they produce.
            The plant/invite actions live below, where a warmed-up reader meets
            them. (A brand-new garden has nothing to consume, so the short
            "nothing growing yet" line sits right above the plant form.) */}
        <p className="eyebrow mb-3">🌱 Growing seeds</p>
        {seeds.length === 0 ? (
          <p className="mb-6 text-sm text-ink-soft">
            Nothing growing yet — plant the first question below.
          </p>
        ) : (
          <ul className="mb-8 space-y-3">
            {seeds.map((s) => (
              <li key={s.id} className="relative">
                <div className="card p-4 transition hover:border-accent">
                  {/* Whole-card link as an overlay, so the author name below can be
                      its own link without nesting anchors. */}
                  <Link
                    href={`/seeds/${s.id}`}
                    aria-label={s.title}
                    className="absolute inset-0 z-[1] rounded-2xl"
                  />
                  <div className="pointer-events-none relative z-[2]">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-serif text-lg text-ink">
                        {s.visibility === "private" && (
                          <span title="Private — only invited members" className="text-sm">🔒</span>
                        )}
                        {s.title}
                      </span>
                      <span className="shrink-0 text-xs text-accent">{stageBadge(s.stage)}</span>
                    </div>
                    {s.content && <p className="line-clamp-2 text-sm text-ink-mid">{s.content}</p>}
                    <p className="mt-2 text-xs text-ink-soft">
                      {s.author?.id ? (
                        <Link
                          href={`/u/${s.author.id}`}
                          className="pointer-events-auto relative transition hover:text-accent hover:underline"
                        >
                          {s.author?.name || "Someone"}
                        </Link>
                      ) : (
                        s.author?.name || "Someone"
                      )}{" "}
                      · {s.contributionCount} contributions
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {bloomed.length > 0 && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">🌸 Bloomed</p>
              <Link href={`/gardens/${garden.id}/tree`} className="text-xs text-ink-soft hover:text-ink">
                See the Sacred Tree →
              </Link>
            </div>
            <ul className="mb-8 space-y-2">
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

        {/* Produce actions — below the content a reader has just scrolled. */}
        <div id="plant-seed" className="card mb-4 p-5">
          <p className="eyebrow mb-3">Plant a seed</p>
          <PlantSeedForm gardenId={garden.id} />
        </div>

        <div className="card p-5">
          <p className="eyebrow mb-3">Invite people</p>
          <InviteForm gardenId={garden.id} gardenName={garden.name} />
        </div>
      </main>
    </div>
  );
}
