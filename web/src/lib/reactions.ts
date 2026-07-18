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

// Noto Animated Emoji codepoints — used to fetch the free Lottie files from
// Google's CDN (see AnimatedEmoji). Codepoints match the static glyphs above
// (❤️ carries the fe0f variation selector). Any codepoint Google doesn't ship an
// animation for simply 404s and AnimatedEmoji keeps the static glyph.
export const REACTION_ANIM: Record<string, string> = {
  // Expressive — animate whenever present (pure warmth).
  love: "2764_fe0f",
  clap: "1f44f",
  haha: "1f602",
  fire: "1f525",
  party: "1f389",
  praise: "1f64c",
  // Signal — animate only past the threshold below, so motion MEANS something.
  clicked: "1f4a5",
  point: "1f4a1",
  agree: "2705",
  mind: "1f9e0",
  fence: "2696_fe0f",
  confuse: "1f914",
  impl: "1f6e0_fe0f",
  ref: "1f4da",
  beauty: "2728",
};

// How many people must land the SAME signal reaction before it comes alive.
// Below this it stays static (calm, scannable); at/above it, the reaction
// animates — motion becomes a real signal: "enough people feel this, look here."
export const SIGNAL_ANIM_THRESHOLD = 2;

const SIGNAL_KEYS = new Set(SIGNAL_REACTIONS.map((r) => r.key));

// Should this reaction animate at the given count? Expressive always animates
// (as long as it has a codepoint); signal animates only once it crosses the
// threshold, so a calm thread stays calm and a hot spot lights up.
export function reactionAnimates(key: string, count: number): boolean {
  if (!REACTION_ANIM[key]) return false;
  return SIGNAL_KEYS.has(key) ? count >= SIGNAL_ANIM_THRESHOLD : true;
}

// Only SIGNAL reactions feed the group read + AI mediator/quorum. Anything not in
// the signal set (expressive, or an unknown legacy key) is treated as expressive.
export function isSignalReaction(key: string): boolean {
  return SIGNAL_KEYS.has(key);
}
