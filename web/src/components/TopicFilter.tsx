import Link from "next/link";

// A horizontal scroll of topic chips that filter the Explore feed. "For you" is
// the default (no ?topic); each chip links to ?topic=<label>. The topics are
// free-form — Claude tags each seed, and the page passes in the ones that
// actually exist, most common first. No fixed taxonomy.
export function TopicFilter({ topics, active }: { topics: string[]; active?: string }) {
  const chip = (href: string, label: string, on: boolean) => (
    <Link
      key={href}
      href={href}
      scroll={false}
      className={
        "shrink-0 rounded-full border px-3 py-1.5 text-xs transition " +
        (on
          ? "border-accent bg-[rgba(76,175,80,0.16)] text-ink"
          : "border-[rgba(255,255,255,0.12)] text-ink-soft hover:border-[rgba(76,175,80,0.4)]")
      }
    >
      {label}
    </Link>
  );

  if (topics.length === 0) return null;

  return (
    <div className="mb-6 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {chip("/explore", "✨ For you", !active)}
      {topics.map((t) => chip(`/explore?topic=${encodeURIComponent(t)}`, t, active === t))}
    </div>
  );
}
