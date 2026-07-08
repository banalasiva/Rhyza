import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getPublicProfile } from "@/lib/services/profile";
import { NavBar } from "@/components/NavBar";
import { Avatar } from "@/components/Avatar";
import { ProfileTopicsEditor } from "@/components/ProfileTopicsEditor";
import { ReflectionEditor, ReflectionPoints } from "@/components/ReflectionEditor";
import { SectionPrivacyToggle } from "@/components/SectionPrivacyToggle";
import { ThinkingFingerprint } from "@/components/ThinkingFingerprint";

export const dynamic = "force-dynamic";

// A person's public profile — reachable by tapping their name anywhere.
export default async function ProfilePage({ params }: { params: { id: string } }) {
  const viewer = await requireViewer();
  const profile = await getPublicProfile(params.id, viewer.userId);
  if (!profile) notFound();

  const isMe = profile.isOwner;
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

          {/* Thinking fingerprint — the archetype + signature that make this
              profile feel earned. The person can hide it; others see it if public. */}
          {(profile.dimensions.length > 0 || isMe) && (
            <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.06)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wide text-ink-soft">🧭 Thinking fingerprint</p>
                {isMe && <SectionPrivacyToggle section="fingerprint" initialPublic={profile.visibility.fingerprint} />}
              </div>
              <ThinkingFingerprint dims={profile.dimensions} self={isMe} />
            </div>
          )}

          {/* Topics — the areas this person is most involved in, named
              automatically by Claude from the seeds they take part in, and
              editable by the person themselves. */}
          {(profile.topics.length > 0 || isMe) && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wide text-ink-soft">Mostly involved in</p>
                {isMe && <SectionPrivacyToggle section="topics" initialPublic={profile.visibility.topics} />}
              </div>
              {profile.topics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.topics.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(76,175,80,0.2)] bg-[rgba(76,175,80,0.05)] px-3 py-1 text-xs text-ink-mid"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                isMe && <p className="text-xs text-ink-soft">No topics yet — they&apos;ll appear as you take part, or add your own.</p>
              )}
              {isMe && <ProfileTopicsEditor initial={profile.topics} />}
            </div>
          )}

          {/* How they show up — Claude's honest mirror, read from real messages.
              The person themselves can edit it; others see it read-only. */}
          {(profile.reflection || isMe) && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wide text-ink-soft">
                  🪞 {isMe ? "How you show up" : "How they show up"}
                </p>
                {isMe && <SectionPrivacyToggle section="reflection" initialPublic={profile.visibility.reflection} />}
              </div>
              {isMe ? (
                <ReflectionEditor initial={profile.reflection} />
              ) : (
                <ReflectionPoints text={profile.reflection} />
              )}
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

          {/* AI tags — how often this person asked Claude / ChatGPT */}
          {profile.aiTags && (profile.aiTags.claude > 0 || profile.aiTags.chatgpt > 0 || isMe) && (
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wide text-ink-soft">Asked the AIs</p>
                {isMe && <SectionPrivacyToggle section="aiTags" initialPublic={profile.visibility.aiTags} />}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,179,0,0.3)] bg-[rgba(255,179,0,0.06)] px-3 py-1.5 text-xs text-ink-mid">
                  <span aria-hidden>✦</span>
                  <span className="font-semibold text-ink">{profile.aiTags.claude}</span> Claude
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(16,163,127,0.3)] bg-[rgba(16,163,127,0.06)] px-3 py-1.5 text-xs text-ink-mid">
                  <span aria-hidden>✦</span>
                  <span className="font-semibold text-ink">{profile.aiTags.chatgpt}</span> ChatGPT
                </span>
              </div>
            </div>
          )}

          {/* Public seeds they're involved in (already world-visible) */}
          {(profile.involvedSeeds.length > 0 || isMe) && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wide text-ink-soft">🌍 Public seeds they&apos;re in</p>
                {isMe && <SectionPrivacyToggle section="seeds" initialPublic={profile.visibility.seeds} />}
              </div>
              {profile.involvedSeeds.length > 0 ? (
                <div className="space-y-2">
                  {profile.involvedSeeds.map((s) => (
                    <Link
                      key={s.id}
                      href={`/seeds/${s.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(76,175,80,0.18)] p-3 transition hover:border-accent"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink">{s.title}</p>
                        <p className="text-xs text-ink-soft">
                          {s.garden?.emoji} {s.garden?.name}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-ink-soft">🌍</span>
                    </Link>
                  ))}
                </div>
              ) : (
                isMe && <p className="text-xs text-ink-soft">Public seeds you start or join will show here.</p>
              )}
            </div>
          )}

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
