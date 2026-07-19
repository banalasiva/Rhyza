import Link from "next/link";
import { signOut } from "@/auth";
import { requireViewer } from "@/lib/session";
import { getMyRoots } from "@/lib/services/roots";
import { listMyLessons } from "@/lib/services/reflections";
import { ShowMore } from "@/components/ShowMore";
import { NavBar } from "@/components/NavBar";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { ProfileEnrich } from "@/components/ProfileEnrich";
import { ProfileRefreshButton } from "@/components/ProfileRefreshButton";
import { ConnectionRequests } from "@/components/ConnectionRequests";
import { DisplayNameEditor } from "@/components/DisplayNameEditor";
import { ProfileTopicsEditor } from "@/components/ProfileTopicsEditor";
import { ReflectionEditor } from "@/components/ReflectionEditor";
import { SectionPrivacyToggle } from "@/components/SectionPrivacyToggle";
import { ThinkingFingerprint } from "@/components/ThinkingFingerprint";
import { ShareButton } from "@/components/ShareButton";
import { STAGES } from "@/lib/constants";

export default async function RootsPage() {
  const viewer = await requireViewer();
  const roots = await getMyRoots(viewer.userId);
  const { stats } = roots;
  // Wisdom compounds: every lesson you've drawn from a bloomed decision, in one
  // place. Best-effort so a missing table never breaks the profile.
  const lessons = await listMyLessons(viewer.userId).catch(() => []);

  const uploadsEnabled = !!process.env.BLOB_READ_WRITE_TOKEN;
  const nothingYet =
    stats.contributions === 0 && stats.bloomsHelped === 0 && stats.seedsPlanted === 0;

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <ProfileEnrich enabled={roots.needsEnrich} />
        <Link href="/" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Your gardens
        </Link>

        <ConnectionRequests />

        <div className="mb-6 flex items-start gap-4">
          <ProfilePhoto name={viewer.name || "You"} image={viewer.avatarUrl} uploadsEnabled={uploadsEnabled} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-1">🌳 Your roots</p>
            <DisplayNameEditor name={viewer.name || "You"} />
            <p className="mt-1 text-sm text-ink-mid">
              {nothingYet
                ? "Your thinking will live here — every point you raise, every decision you help bloom."
                : "Here's what you've grown across the community."}
            </p>
          </div>
          <ShareButton
            iconOnly
            path={`/u/${viewer.userId}`}
            title={`${viewer.name || "My"} ThinkThru profile`}
            text="My ThinkThru profile"
          />
        </div>

        <p className="mb-3 -mt-3 text-[11px] text-ink-soft">
          Your profile is a shareable link — anyone who opens it sees only what you&apos;ve marked
          public.
        </p>

        {/* Recognized for — virtues peers credited you with, each earned on a
            real message. Earned reputation, not a score. */}
        {roots.virtues.length > 0 && (
          <section className="mb-8">
            <p className="eyebrow mb-3">✨ Recognized for</p>
            <div className="flex flex-wrap gap-2">
              {roots.virtues.map((v) => (
                <span
                  key={v.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(76,175,80,0.25)] bg-[rgba(76,175,80,0.06)] px-3 py-1.5 text-sm text-ink"
                >
                  <span aria-hidden>{v.emoji}</span>
                  {v.label}
                  <span className="text-xs text-ink-soft">
                    · {v.people} {v.people === 1 ? "person" : "people"}
                  </span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* How you show up — Claude's honest mirror of what you bring to a
            conversation, read from your real messages. Yours to edit. */}
        {(roots.reflection || !nothingYet) && (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="eyebrow">🪞 How you show up</p>
              <div className="flex items-center gap-1">
                {!nothingYet && <ProfileRefreshButton />}
                <SectionPrivacyToggle section="reflection" initialPublic={roots.visibility.reflection} />
              </div>
            </div>
            <div className="card p-4">
              <ReflectionEditor initial={roots.reflection} />
            </div>
          </section>
        )}

        {/* Lessons you've drawn — the wisdom that compounds. Each one was earned
            from a real decision looking back at how reality turned out. Private. */}
        {lessons.length > 0 && (
          <section className="mb-8">
            <p className="eyebrow mb-1">💡 Lessons you&apos;ve drawn</p>
            <p className="mb-3 text-[11px] text-ink-soft">
              What reality taught you, decision by decision. Only you can see these.
            </p>
            <ShowMore noun="lessons">
              {lessons.map((l) => (
                <Link
                  key={l.bloomId}
                  href={`/blooms/${l.bloomId}`}
                  className="card flex items-start gap-3 p-3 transition hover:border-[rgba(255,179,0,0.4)]"
                >
                  <span aria-hidden className="mt-0.5">💡</span>
                  <span className="min-w-0 flex-1 text-sm text-ink">{l.lesson}</span>
                  {l.outcome && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                      style={{
                        color: l.outcome === "worse" ? "#e57373" : "#FFB300",
                        background:
                          l.outcome === "worse" ? "rgba(229,115,115,0.1)" : "rgba(255,179,0,0.1)",
                      }}
                    >
                      {l.outcome === "better"
                        ? "turned out better"
                        : l.outcome === "worse"
                          ? "turned out worse"
                          : "as expected"}
                    </span>
                  )}
                </Link>
              ))}
            </ShowMore>
          </section>
        )}

        {/* Stat chips */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat n={stats.bloomsHelped} label="Blooms grown" accent="#FFB300" />
          <Stat n={stats.contributions} label="Thoughts shared" accent="#66BB6A" />
          <Stat n={stats.endorsementsReceived} label="Found valuable" accent="#EC407A" />
          <Stat n={stats.seedsPlanted} label="Seeds planted" accent="#42A5F5" />
        </div>

        {/* Mostly involved in — free-form topics Claude names from your activity,
            editable right here. */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="eyebrow">🌿 Mostly involved in</p>
            <SectionPrivacyToggle section="topics" initialPublic={roots.visibility.topics} />
          </div>
          <div className="card p-4">
            {roots.topics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {roots.topics.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center rounded-full border border-[rgba(76,175,80,0.2)] bg-[rgba(76,175,80,0.05)] px-3 py-1 text-xs text-ink-mid"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-soft">
                These fill in as you take part — the areas you&apos;re most involved in. Add your own
                or refresh anytime.
              </p>
            )}
            <ProfileTopicsEditor initial={roots.topics} />
          </div>
        </section>

        {/* Asked the AIs — how often you tagged Claude / ChatGPT */}
        {(roots.aiTags.claude > 0 || roots.aiTags.chatgpt > 0) && (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="eyebrow">✦ You asked the AIs</p>
              <SectionPrivacyToggle section="aiTags" initialPublic={roots.visibility.aiTags} />
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,179,0,0.3)] bg-[rgba(255,179,0,0.06)] px-3 py-1.5 text-xs text-ink-mid">
                <span aria-hidden>✦</span>
                <span className="font-semibold text-ink">{roots.aiTags.claude}</span> Claude
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(16,163,127,0.3)] bg-[rgba(16,163,127,0.06)] px-3 py-1.5 text-xs text-ink-mid">
                <span aria-hidden>✦</span>
                <span className="font-semibold text-ink">{roots.aiTags.chatgpt}</span> ChatGPT
              </span>
            </div>
          </section>
        )}

        {/* Public seeds you're in — safe to show (already world-visible) */}
        {roots.involvedSeeds.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="eyebrow">🌍 Public seeds you&apos;re in</p>
              <SectionPrivacyToggle section="seeds" initialPublic={roots.visibility.seeds} />
            </div>
            <ShowMore noun="seeds">
              {roots.involvedSeeds.map((s) => (
                <Link
                  key={s.id}
                  href={`/seeds/${s.id}`}
                  className="card flex items-center justify-between gap-3 p-3.5 transition hover:border-accent"
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
            </ShowMore>
          </section>
        )}

        {/* Thinking fingerprint — your archetype + the mix that's uniquely yours */}
        {roots.dimensions.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="eyebrow">🧭 Your thinking fingerprint</p>
              <SectionPrivacyToggle section="fingerprint" initialPublic={roots.visibility.fingerprint} />
            </div>
            <div className="card p-4">
              <ThinkingFingerprint dims={roots.dimensions} self />
            </div>
          </section>
        )}

        {/* Blooms your thinking lives in */}
        {roots.blooms.length > 0 && (
          <section className="mb-8">
            <p className="eyebrow mb-3">🌸 Your thinking lives in these</p>
            <ShowMore noun="blooms">
              {roots.blooms.map((b) => (
                <Link
                  key={b.bloomId}
                  href={`/blooms/${b.bloomId}`}
                  className="card flex items-center justify-between gap-3 p-3.5 transition hover:border-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{b.title}</p>
                    <p className="text-xs text-ink-soft">
                      {b.garden?.emoji} {b.garden?.name} · {b.role}
                    </p>
                  </div>
                  <span className="shrink-0 text-bloom">🌸</span>
                </Link>
              ))}
            </ShowMore>
          </section>
        )}

        {/* Seeds you planted */}
        {roots.planted.length > 0 && (
          <section className="mb-8">
            <p className="eyebrow mb-3">🌱 Seeds you planted</p>
            <ShowMore noun="seeds">
              {roots.planted.map((s) => {
                const stage = STAGES.find((x) => x.key === s.stage) ?? STAGES[0];
                const href = s.bloomId ? `/blooms/${s.bloomId}` : `/seeds/${s.id}`;
                return (
                  <Link
                    key={s.id}
                    href={href}
                    className="card flex items-center justify-between gap-3 p-3.5 transition hover:border-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{s.title}</p>
                      <p className="text-xs text-ink-soft">
                        {s.garden?.emoji} {s.garden?.name}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-soft">
                      {stage.emoji} {stage.label}
                    </span>
                  </Link>
                );
              })}
            </ShowMore>
          </section>
        )}

        {/* Recognition */}
        {roots.recognitions.length > 0 && (
          <section className="mb-8">
            <p className="eyebrow mb-3">✦ Recognition</p>
            <div className="flex flex-wrap gap-2">
              {roots.recognitions.map((r, i) => (
                <span
                  key={i}
                  className="rounded-full border border-[rgba(76,175,80,0.25)] px-3 py-1 text-xs text-ink-mid"
                >
                  {r.emoji} {r.label}
                  {r.gardenName && <span className="text-ink-soft"> · {r.gardenName}</span>}
                </span>
              ))}
            </div>
          </section>
        )}

        {nothingYet && (
          <div className="card p-6 text-center">
            <div className="mb-2 text-3xl">🌱</div>
            <p className="mb-3 text-sm text-ink-mid">
              Plant a question or add a thought to a seed — and watch your roots spread.
            </p>
            <Link href="/" className="btn-primary text-sm">
              Go to your gardens
            </Link>
          </div>
        )}

        {/* Account — signed-in-as + a plainly visible sign out. Sign out was
            buried in the side panel; onboarding needs it obvious (especially when
            someone logs into the wrong Google account and needs to switch). */}
        <div className="mt-10 border-t border-[rgba(255,255,255,0.08)] pt-5">
          <p className="text-xs text-ink-soft">
            Signed in as <span className="text-ink-mid">{viewer.email}</span>
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
            className="mt-2"
          >
            <button type="submit" className="btn-ghost px-4 py-2 text-sm">
              ↩ Sign out
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent: string }) {
  return (
    <div className="card p-3 text-center">
      <p className="serif-lg" style={{ color: accent }}>
        {n}
      </p>
      <p className="text-[11px] text-ink-soft">{label}</p>
    </div>
  );
}
