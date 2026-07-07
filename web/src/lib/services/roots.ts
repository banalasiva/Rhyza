import { db } from "@/lib/db";
import { DIMENSIONS } from "@/lib/constants";
import { ensureUserTopics, getAiTagCounts } from "@/lib/services/profile";

// "What you've grown" — a person's durable footprint: the blooms their thinking
// lives in, the seeds they planted, how they tend to contribute, and the
// recognition they've received. The opposite of a feed: it accrues.
export async function getMyRoots(userId: string) {
  const [bloomContribs, myContribs, plantedSeeds, endorsementsReceived, recognitions] =
    await Promise.all([
      db.bloomContributor.findMany({
        where: { userId },
        include: {
          bloom: {
            include: {
              seed: { select: { id: true } },
              garden: { select: { id: true, name: true, emoji: true } },
            },
          },
        },
        orderBy: { addedAt: "desc" },
      }),
      db.contribution.findMany({
        where: { authorId: userId, deletedAt: null },
        select: { dimension: true, seedId: true },
      }),
      db.seed.findMany({
        where: { createdById: userId, deletedAt: null },
        select: {
          id: true,
          title: true,
          stage: true,
          bloomId: true,
          garden: { select: { id: true, name: true, emoji: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.contributionEndorsement.count({ where: { contribution: { authorId: userId } } }),
      db.userRecognition.findMany({
        where: { userId },
        include: { label: true, garden: { select: { name: true } } },
      }),
    ]);

  // How you think — share of contributions across the five dimensions.
  const counts: Record<string, number> = {};
  for (const c of myContribs) counts[c.dimension] = (counts[c.dimension] ?? 0) + 1;
  const total = myContribs.length;
  const dimensions = DIMENSIONS.map((d) => ({
    key: d.key,
    label: d.label,
    emoji: d.emoji,
    color: d.color,
    count: counts[d.key] ?? 0,
    pct: total > 0 ? Math.round(((counts[d.key] ?? 0) / total) * 100) : 0,
  }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);

  const distinctSeeds = new Set(myContribs.map((c) => c.seedId));
  for (const s of plantedSeeds) distinctSeeds.add(s.id);

  // The free-form areas Claude sees this person involved in, and how often they
  // reached for each AI. Both best-effort — never block the page.
  const hasActivity = total > 0 || plantedSeeds.length > 0;
  const [topics, aiTags] = await Promise.all([
    ensureUserTopics(userId, hasActivity).catch(() => [] as string[]),
    getAiTagCounts(userId),
  ]);

  return {
    topics,
    aiTags,
    stats: {
      bloomsHelped: bloomContribs.length,
      contributions: total,
      endorsementsReceived,
      seedsPlanted: plantedSeeds.length,
      seedsTouched: distinctSeeds.size,
    },
    dimensions,
    blooms: bloomContribs
      .filter((bc) => bc.bloom)
      .map((bc) => ({
        bloomId: bc.bloomId,
        title: bc.bloom.title,
        garden: bc.bloom.garden,
        role: bc.role,
        version: bc.bloom.version,
        bloomedAt: bc.bloom.bloomedAt.toISOString(),
      })),
    planted: plantedSeeds.map((s) => ({
      id: s.id,
      title: s.title,
      stage: s.stage,
      bloomId: s.bloomId,
      garden: s.garden,
    })),
    recognitions: recognitions.map((r) => ({
      label: r.label?.label ?? r.labelKey,
      emoji: r.label?.emoji ?? "✦",
      gardenName: r.garden?.name ?? "",
    })),
  };
}
