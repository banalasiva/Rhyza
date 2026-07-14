import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Seeds ONLY product configuration registries — the reaction palette and the
// recognition labels. These are "data not code" extension points from
// docs/ARCHITECTURE.md. There is intentionally no demo user, org, garden, or
// seed content here: the app starts empty and real.

// Two tiers — SIGNAL (feeds the group read + AI quorum) then EXPRESSIVE (warmth,
// excluded from the quorum). Kept in sync with src/lib/reactions.ts, which is the
// runtime source of truth for which keys are signal vs expressive.
const reactionTypes = [
  // signal
  { key: "clicked", emoji: "💥", label: "It clicked", sortOrder: 1 },
  { key: "point", emoji: "💡", label: "Good point", sortOrder: 2 },
  { key: "agree", emoji: "✅", label: "I'm with this", sortOrder: 3 },
  { key: "mind", emoji: "🧠", label: "Changed thinking", sortOrder: 4 },
  { key: "fence", emoji: "⚖️", label: "On the fence", sortOrder: 5 },
  { key: "confuse", emoji: "🤔", label: "Still confused", sortOrder: 6 },
  { key: "impl", emoji: "🛠️", label: "I tried this", sortOrder: 7 },
  { key: "ref", emoji: "📚", label: "Great reference", sortOrder: 8 },
  { key: "beauty", emoji: "✨", label: "Beautifully said", sortOrder: 9 },
  // expressive
  { key: "love", emoji: "❤️", label: "Love", sortOrder: 20 },
  { key: "clap", emoji: "👏", label: "Applause", sortOrder: 21 },
  { key: "haha", emoji: "😂", label: "Haha", sortOrder: 22 },
  { key: "fire", emoji: "🔥", label: "Fire", sortOrder: 23 },
  { key: "party", emoji: "🎉", label: "Celebrate", sortOrder: 24 },
  { key: "praise", emoji: "🙌", label: "Yes!", sortOrder: 25 },
];

const recognitionLabels = [
  { key: "thinker", emoji: "🧠", label: "Thinker", description: "Frames problems clearly", sortOrder: 1 },
  { key: "explainer", emoji: "💡", label: "Explainer", description: "Makes hard things simple", sortOrder: 2 },
  { key: "practitioner", emoji: "🛠", label: "Practitioner", description: "Grounds ideas in practice", sortOrder: 3 },
  { key: "debater", emoji: "⚖", label: "Debater", description: "Pressure-tests ideas", sortOrder: 4 },
  { key: "mentor", emoji: "🌳", label: "Mentor", description: "Grows others", sortOrder: 5 },
  { key: "amplifier", emoji: "📣", label: "Amplifier", description: "Spreads good ideas", sortOrder: 6 },
  { key: "explorer", emoji: "🧭", label: "Explorer", description: "Finds new ground", sortOrder: 7 },
];

async function main() {
  for (const r of reactionTypes) {
    await db.reactionType.upsert({
      where: { key: r.key },
      update: { emoji: r.emoji, label: r.label, sortOrder: r.sortOrder },
      create: r,
    });
  }
  for (const l of recognitionLabels) {
    await db.recognitionLabel.upsert({
      where: { key: l.key },
      update: { emoji: l.emoji, label: l.label, description: l.description, sortOrder: l.sortOrder },
      create: l,
    });
  }
  console.log(
    `Seeded ${reactionTypes.length} reaction types and ${recognitionLabels.length} recognition labels.`,
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
