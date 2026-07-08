import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { listExplore, getExploreTopics, listPublicGardens } from "@/lib/services/explore";
import { NavBar } from "@/components/NavBar";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";
import { TopicFilter } from "@/components/TopicFilter";
import { STAGES } from "@/lib/constants";

export const dynamic = "force-dynamic";

function stageBadge(stage: string) {
  const s = STAGES.find((x) => x.key === stage) ?? STAGES[0];
  return `${s.emoji} ${s.label}`;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: { topic?: string };
}) {
  const viewer = await requireViewer();
  const topic = searchParams.topic?.trim() || undefined;

  const [seeds, topics, gardens] = await Promise.all([
    listExplore(viewer.userId, { topic }),
    getExploreTopics(),
    listPublicGardens(),
  ]);

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="eyebrow mb-2">🌍 Explore</p>
        <h1 className="serif-xl mb-2">
          {topic ? topic : "Questions the world is thinking through."}
        </h1>
        <p className="mb-6 max-w-xl text-sm text-ink-mid">
          {topic
            ? `Public seeds about ${topic.toLowerCase()}. Follow the ones you care about.`
            : "Public seeds from communities everywhere. Follow the ones you care about — you’ll hear when they grow or bloom, and you can jump in any time. Your feed leans toward the areas you’re involved in."}
        </p>

        {/* Public gardens — world-open topic hubs anyone can browse. Only on the
            unfiltered view, so a topic search stays focused on seeds. */}
        {!topic && gardens.length > 0 && (
          <section className="mb-7">
            <p className="eyebrow mb-3">🌳 Public gardens</p>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {gardens.map((g) => (
                <Link
                  key={g.id}
                  href={`/gardens/${g.id}`}
                  className="card w-56 shrink-0 p-4 transition hover:border-accent"
                >
                  <div className="mb-1 text-2xl" aria-hidden>{g.emoji || "🌳"}</div>
                  <p className="truncate font-serif text-base text-ink">{g.name}</p>
                  {g.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-mid">{g.description}</p>
                  )}
                  <p className="mt-2 text-[11px] text-ink-soft">
                    🌱 {g.seedCount} {g.seedCount === 1 ? "discussion" : "discussions"} · by {g.author}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <TopicFilter topics={topics} active={topic} />

        {seeds.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="mb-2 text-3xl">🌱</div>
            <p className="text-ink-mid">
              {topic
                ? `No public seeds about ${topic.toLowerCase()} yet.`
                : "Nothing public yet — be the first to share a seed with the world."}
            </p>
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
                {s.topics.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.topics.map((t) => (
                      <Link
                        key={t}
                        href={`/explore?topic=${encodeURIComponent(t)}`}
                        className="rounded-full border border-[rgba(76,175,80,0.22)] px-2 py-0.5 text-[10px] text-ink-soft hover:border-accent hover:text-ink"
                      >
                        {t}
                      </Link>
                    ))}
                  </div>
                )}
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
