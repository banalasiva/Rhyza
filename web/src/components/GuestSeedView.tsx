import Link from "next/link";
import { Avatar } from "@/components/Avatar";

// Read-only view of a public seed for a signed-out guest. Anyone with the link
// can read the question and the conversation — reading "just works" without an
// account. Every action (react, reply, join, ask AI) is a sign-in call-to-
// action instead of a live control, so a guest can never write or trigger a
// paid AI call. The data comes from getPublicSeedForGuest, which only ever
// returns public seeds.

type Guest = {
  id: string;
  title: string;
  content: string | null;
  stage: string;
  bloomId: string | null;
  author: { id: string; name: string; image: string | null };
  garden: { id: string; name: string; emoji: string };
  memberCount: number;
  contributions: {
    id: string;
    text: string;
    author: { id: string; name: string; image: string | null };
    createdAt: string;
    reactionCounts: Record<string, number>;
  }[];
};

export function GuestSeedView({
  seed,
  reactionEmoji,
}: {
  seed: Guest;
  reactionEmoji: Record<string, string>;
}) {
  const signIn = `/login?next=${encodeURIComponent(`/seeds/${seed.id}`)}`;
  const isBloomed = !!seed.bloomId;
  const messages = seed.contributions.filter((c) => c.text.trim().length > 0);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Question */}
      <p className="eyebrow mb-1">{isBloomed ? "🌸 A decision, in the open" : "🌱 A question, in the open"}</p>
      <h1 className="serif-xl mb-2 break-words">{seed.title}</h1>
      <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <Avatar name={seed.author.name} image={seed.author.image} size={18} />
          {seed.author.name}
        </span>
        <span aria-hidden>·</span>
        <span>🌍 Public</span>
        <span aria-hidden>·</span>
        <span>
          {seed.memberCount} {seed.memberCount === 1 ? "person" : "people"} thinking it through
        </span>
      </p>

      {seed.content && seed.content.trim() && (
        <p className="card mb-5 whitespace-pre-wrap p-4 text-sm text-ink-mid">{seed.content}</p>
      )}

      {isBloomed && (
        <Link
          href={signIn}
          className="mb-5 flex items-center gap-3 rounded-2xl border border-[rgba(255,179,0,0.35)] bg-[rgba(255,179,0,0.08)] p-4 transition hover:border-[rgba(255,179,0,0.55)]"
        >
          <span className="text-2xl" aria-hidden>🌸</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">This grew into a shared decision</span>
            <span className="block text-xs text-ink-soft">Sign in to read the bloom and how it landed.</span>
          </span>
          <span aria-hidden className="text-ink-soft">→</span>
        </Link>
      )}

      {/* The conversation, read-only */}
      <p className="eyebrow mb-3">💬 The conversation</p>
      {messages.length === 0 ? (
        <p className="card p-5 text-center text-sm text-ink-soft">
          Quiet so far. Be the first to share how you see it.
        </p>
      ) : (
        <ul className="space-y-3">
          {messages.map((c) => {
            const reactions = Object.entries(c.reactionCounts).filter(([, n]) => n > 0);
            return (
              <li key={c.id} className="card p-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <Avatar name={c.author.name} image={c.author.image} size={26} />
                  <span className="text-sm font-medium text-ink">{c.author.name}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-mid">{c.text}</p>
                {reactions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {reactions.map(([key, n]) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.1)] px-2 py-0.5 text-xs text-ink-soft"
                      >
                        <span aria-hidden>{reactionEmoji[key] ?? "•"}</span>
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Gentle sign-in invitation — the one place a guest converts. */}
      <div className="mt-6 rounded-2xl border border-[rgba(76,175,80,0.3)] bg-[rgba(76,175,80,0.07)] p-5 text-center">
        <p className="serif-lg mb-1">Want to join in?</p>
        <p className="mx-auto mb-4 max-w-sm text-sm text-ink-soft">
          Reading is open to everyone. To react, reply, or add your own read, it takes a quick
          sign-in — free, a few seconds.
        </p>
        <Link href={signIn} className="btn-primary text-sm">
          Sign in to join the conversation
        </Link>
      </div>
    </div>
  );
}
