import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { listWorldSharedSeeds } from "@/lib/services/explore";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Look around · ThinkThru" };

// "Look around first" — a signed-out visitor browses the public square (world-
// shared seeds) read-only, before deciding to join. Every card opens a seed a
// guest can actually read (getPublicSeedForGuest gates the seed page the same
// way). Signed-in people get the real Explore instead.
export default async function LookAroundPage() {
  const viewer = await getViewer();
  if (viewer) redirect("/explore");

  const seeds = await listWorldSharedSeeds(40);

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <header className="relative z-20 flex items-center justify-between px-5 py-3">
        <Link href="/login" className="flex items-center gap-2">
          <Image src="/emblem.png" alt="" width={26} height={26} className="rounded-lg" />
          <span className="serif-lg">ThinkThru</span>
        </Link>
        <Link href="/login" className="btn-primary text-sm">
          Sign in
        </Link>
      </header>

      <main id="main" className="relative z-10 mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-8">
        <p className="eyebrow mb-1">👀 Look around</p>
        <h1 className="serif-xl mb-2">Decisions being thought through, in the open</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Real questions real groups are working out together. Read any of them — then sign in
          (free) to add your voice or start your own.
        </p>

        {seeds.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-soft">
            Nothing shared with the world just yet. Sign in to plant the first one 🌱
          </div>
        ) : (
          <ul className="space-y-3">
            {seeds.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/seeds/${s.id}`}
                  className="card block p-4 transition hover:border-accent"
                >
                  <p className="mb-1 text-[11px] text-ink-soft">
                    {s.garden.emoji} {s.garden.name}
                  </p>
                  <p className="serif-lg leading-snug">{s.title}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-soft">
                    <Avatar name={s.author.name} image={s.author.image} size={18} />
                    <span>{s.author.name}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {s.contributionCount} {s.contributionCount === 1 ? "reply" : "replies"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 rounded-2xl border border-[rgba(76,175,80,0.3)] bg-[rgba(76,175,80,0.07)] p-5 text-center">
          <p className="serif-lg mb-1">Like what you see?</p>
          <p className="mx-auto mb-4 max-w-sm text-sm text-ink-soft">
            Reading is open to everyone. To react, reply, or think through your own decision, it
            takes a quick, free sign-in.
          </p>
          <Link href="/login" className="btn-primary text-sm">
            Sign in to join
          </Link>
        </div>
      </main>
    </div>
  );
}
