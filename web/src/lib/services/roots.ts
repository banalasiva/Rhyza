import { db } from "@/lib/db";
import { DIMENSIONS } from "@/lib/constants";
import {
  getUserTopics,
  getAiTagCounts,
  getUserReflection,
  getSectionVisibility,
  getInvolvedPublicSeeds,
} from "@/lib/services/profile";

// "What you've grown" — a person's durable footprint: the blooms their thinking
// lives in, the seeds they planted, how they tend to contribute, and the
// recognition they've received. The opposite of a feed: it accrues.
export async function getMyRoots(userId: string) {
  // ONE parallel batch. topics/reflection are READ-ONLY here (generating them is
  // a Claude call that must never block the page) and depend only on userId, so
  // they join the batch instead of running as a second sequential wave.
  const [
    bloomContribs,
    myContribs,
    plantedSeeds,
    endorsementsReceived,
    recognitions,
    topics,
    aiTags,
    reflection,
    visibility,
    involvedSeeds,
  ] = await Promise.all([
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
    getUserTopics(userId).catch(() => [] as string[]),
    getAiTagCounts(userId),
    getUserReflection(userId).catch(() => ""),
    getSectionVisibility(userId),
    getInvolvedPublicSeeds(userId).catch(() => []),
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

  // If the AI-derived topics/reflection are missing but there's enough activity,
  // the client kicks generation off out-of-band (a Claude call — never inline in
  // this render) and refreshes when ready.
  const hasActivity = total > 0 || plantedSeeds.length > 0;
  const needsEnrich =
    (topics.length === 0 && hasActivity) || (!reflection && total >= 3);

  return {
    topics,
    aiTags,
    reflection,
    visibility,
    involvedSeeds,
    needsEnrich,
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
