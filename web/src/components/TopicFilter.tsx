import Link from "next/link";
import { EXPLORE_TOPICS } from "@/lib/constants";

// A horizontal scroll of topic chips that filter the Explore feed. "For you" is
// the default (no ?topic); each chip links to ?topic=<key>. Server-rendered —
// the page reads the active topic from the URL.
export function TopicFilter({ active }: { active?: string }) {
  const chip = (href: string, label: string, on: boolean) => (
    <Link
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

  return (
    <div className="mb-6 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {chip("/explore", "✨ For you", !active)}
      {EXPLORE_TOPICS.map((t) =>
        chip(`/explore?topic=${t.key}`, `${t.emoji} ${t.label}`, active === t.key),
      )}
    </div>
  );
}
