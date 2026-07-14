// The reaction vocabulary — TWO tiers, and the distinction is load-bearing:
//
//   • SIGNAL     — meaningful, aggregatable reactions that feed the group's read
//                  AND the AI mediator/quorum ("🤔 Still confused ×3"). Keep this
//                  set small and curated, or the signal degrades into noise.
//   • EXPRESSIVE — warm, human reactions (love, applause, laughter). They show on
//                  a message and animate, but are DELIBERATELY excluded from the
//                  quorum/AI read so they can never dilute the signal.
//
// The existing 6 signal keys (clicked/beauty/mind/impl/ref/confuse) are preserved
// exactly — existing reaction rows reference them by key.

export type ReactionDef = { key: string; emoji: string; label: string; sortOrder: number };

export const SIGNAL_REACTIONS: ReactionDef[] = [
  { key: "clicked", emoji: "💥", label: "It clicked", sortOrder: 1 },
  { key: "point", emoji: "💡", label: "Good point", sortOrder: 2 },
  { key: "agree", emoji: "✅", label: "I'm with this", sortOrder: 3 },
  { key: "mind", emoji: "🧠", label: "Changed thinking", sortOrder: 4 },
  { key: "fence", emoji: "⚖️", label: "On the fence", sortOrder: 5 },
  { key: "confuse", emoji: "🤔", label: "Still confused", sortOrder: 6 },
  { key: "impl", emoji: "🛠️", label: "I tried this", sortOrder: 7 },
  { key: "ref", emoji: "📚", label: "Great reference", sortOrder: 8 },
  { key: "beauty", emoji: "✨", label: "Beautifully said", sortOrder: 9 },
];

export const EXPRESSIVE_REACTIONS: ReactionDef[] = [
  { key: "love", emoji: "❤️", label: "Love", sortOrder: 20 },
  { key: "clap", emoji: "👏", label: "Applause", sortOrder: 21 },
  { key: "haha", emoji: "😂", label: "Haha", sortOrder: 22 },
  { key: "fire", emoji: "🔥", label: "Fire", sortOrder: 23 },
  { key: "party", emoji: "🎉", label: "Celebrate", sortOrder: 24 },
  { key: "praise", emoji: "🙌", label: "Yes!", sortOrder: 25 },
];

export const ALL_REACTIONS: ReactionDef[] = [...SIGNAL_REACTIONS, ...EXPRESSIVE_REACTIONS];

const SIGNAL_KEYS = new Set(SIGNAL_REACTIONS.map((r) => r.key));

// Only SIGNAL reactions feed the group read + AI mediator/quorum. Anything not in
// the signal set (expressive, or an unknown legacy key) is treated as expressive.
export function isSignalReaction(key: string): boolean {
  return SIGNAL_KEYS.has(key);
}
