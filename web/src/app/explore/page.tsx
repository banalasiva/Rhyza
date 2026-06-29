import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { listExplore } from "@/lib/services/explore";
import { NavBar } from "@/components/NavBar";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";
import { STAGES } from "@/lib/constants";

export const dynamic = "force-dynamic";

function stageBadge(stage: string) {
  const s = STAGES.find((x) => x.key === stage) ?? STAGES[0];
  return `${s.emoji} ${s.label}`;
}

export default async function ExplorePage() {
  const viewer = await requireViewer();
  const seeds = await listExplore(viewer.userId);

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="eyebrow mb-2">🌍 Explore</p>
        <h1 className="serif-xl mb-2">Questions the world is thinking through.</h1>
        <p className="mb-8 max-w-xl text-sm text-ink-mid">
          Public seeds from communities everywhere. Follow the ones you care about — you&apos;ll
          hear when they grow or bloom, and you can jump in any time.
        </p>

        {seeds.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="mb-2 text-3xl">🌱</div>
            <p className="text-ink-mid">Nothing public yet — be the first to share a seed with the world.</p>
            <p className="mt-1 text-xs text-ink-soft">
              Open any seed you own, tap its details, and choose “Share with the world”.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {seeds.map((s) => (
              <li key={s.id} className="card p-4">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <Link href={`/seeds/${s.id}`} className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                      <span>{s.garden.emoji}</span>
                      <span className="truncate">{s.garden.name}</span>
                      <span>·</span>
                      <span className="shrink-0 text-accent">{stageBadge(s.stage)}</span>
                    </span>
                    <p className="mt-1 font-serif text-lg leading-snug text-ink hover:text-accent">
                      {s.title}
                    </p>
                  </Link>
                  <FollowButton seedId={s.id} initialFollowing={s.following} />
                </div>
                {s.content && <p className="line-clamp-2 text-sm text-ink-mid">{s.content}</p>}
                <div className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
                  <Avatar name={s.author.name} image={s.author.image} size={18} />
                  <span className="truncate">{s.author.name}</span>
                  <span>·</span>
                  <span>💬 {s.contributionCount}</span>
                  <span>·</span>
                  <span>👀 {s.followerCount}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
