import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getPublicProfile } from "@/lib/services/profile";
import { NavBar } from "@/components/NavBar";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

// A person's public profile — reachable by tapping their name anywhere.
export default async function ProfilePage({ params }: { params: { id: string } }) {
  const viewer = await requireViewer();
  const profile = await getPublicProfile(params.id);
  if (!profile) notFound();

  const isMe = profile.id === viewer.userId;
  const joined = new Date(profile.joinedAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const chips = [
    { n: profile.stats.seedsPlanted, label: profile.stats.seedsPlanted === 1 ? "seed planted" : "seeds planted", emoji: "🌱" },
    { n: profile.stats.contributions, label: profile.stats.contributions === 1 ? "thought shared" : "thoughts shared", emoji: "💬" },
    { n: profile.stats.bloomsHelped, label: profile.stats.bloomsHelped === 1 ? "bloom" : "blooms", emoji: "🌸" },
  ];

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Home
        </Link>

        <div className="card p-5">
          <div className="flex items-center gap-4">
            <Avatar name={profile.name} image={profile.image} size={64} />
            <div className="min-w-0">
              <h1 className="serif-lg leading-tight">{profile.name}</h1>
              <p className="mt-0.5 text-xs text-ink-soft">Growing here since {joined}</p>
            </div>
          </div>

          {profile.bio && <p className="mt-4 text-sm leading-relaxed text-ink-mid">{profile.bio}</p>}

          {/* Topics they're involved in — auto-inferred by Claude from the seeds
              they take part in. */}
          {profile.topics.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-soft">Explores</p>
              <div className="flex flex-wrap gap-2">
                {profile.topics.map((t) => (
                  <span
                    key={t.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(76,175,80,0.2)] bg-[rgba(76,175,80,0.05)] px-3 py-1 text-xs text-ink-mid"
                  >
                    <span aria-hidden>{t.emoji}</span> {t.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Activity */}
          <div className="mt-5 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span
                key={c.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(76,175,80,0.2)] px-3 py-1.5 text-xs text-ink-mid"
              >
                <span aria-hidden>{c.emoji}</span>
                <span className="font-semibold text-ink">{c.n}</span> {c.label}
              </span>
            ))}
          </div>

          {isMe && (
            <Link href="/roots" className="btn-ghost mt-5 inline-flex text-xs">
              🌳 See everything you've grown
            </Link>
          )}
        </div>

        {/* Recognition from the community */}
        {profile.recognitions.length > 0 && (
          <div className="card mt-4 p-5">
            <p className="eyebrow mb-3">✦ What the community noticed</p>
            <div className="flex flex-wrap gap-2">
              {profile.recognitions.map((r) => (
                <span
                  key={r.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,179,0,0.3)] bg-[rgba(255,179,0,0.06)] px-3 py-1.5 text-xs text-ink"
                >
                  <span aria-hidden>{r.emoji}</span> {r.label}
                  {r.count > 1 && <span className="text-ink-soft">×{r.count}</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
