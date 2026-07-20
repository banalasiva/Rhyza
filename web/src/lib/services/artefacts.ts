import { db } from "@/lib/db";
import {
  getReflectionSummary,
  getReflectionsByArea,
  listMyLessons,
  getMyReflection,
  judgementInsight,
  lessonsInsight,
  type ReflectionSummary,
} from "@/lib/services/reflections";

// One gather for all five shareable cards, so the /share hub is a single call.
// Everything here is the viewer's OWN content (their decisions, their lessons,
// their reflections) — nothing private of anyone else's — so a card is always
// safe for them to share.

export type ArtefactData = {
  name: string;
  seedsPlanted: number;
  bloomsCount: number;
  summary: ReflectionSummary;
  judgementInsight: string | null;
  lessonsInsight: string | null;
  lessons: { lesson: string; weight: string | null }[];
  areas: { name: string; emoji: string; reflected: number; better: number; worse: number }[];
  tree: { title: string; emoji: string }[];
  latestBloom:
    | { title: string; garden: string; outcome: string | null; lesson: string; sameAgain: string | null }
    | null;
};

const WEIGHT_OF: Record<string, string> = {
  very_tough: "🔥 hard-won",
  tough: "💪 tough",
  medium: "🌿 fair",
  easy: "🍃 easy",
  very_easy: "☁️ light",
};
export const WEIGHT_LABEL = WEIGHT_OF;

export async function getArtefactData(userId: string, viewerName: string): Promise<ArtefactData> {
  const first = (viewerName || "You").trim().split(/\s+/)[0];

  const [seedsPlanted, bloomsCount, summary, lessonsRaw, areasRaw, latestSeed] = await Promise.all([
    db.seed.count({ where: { createdById: userId, deletedAt: null } }).catch(() => 0),
    db.seed
      .count({ where: { createdById: userId, deletedAt: null, bloomId: { not: null } } })
      .catch(() => 0),
    getReflectionSummary(userId).catch(
      () =>
        ({
          reflected: 0,
          outcome: { better: 0, expected: 0, worse: 0 },
          sameAgain: { yes: 0, unsure: 0, no: 0 },
          weight: { very_tough: 0, tough: 0, medium: 0, easy: 0, very_easy: 0 },
        }) as ReflectionSummary,
    ),
    listMyLessons(userId).catch(() => []),
    getReflectionsByArea(userId).catch(() => []),
    db.seed
      .findFirst({
        where: { createdById: userId, deletedAt: null, bloomId: { not: null } },
        orderBy: { updatedAt: "desc" },
        select: { title: true, bloomId: true, garden: { select: { emoji: true, name: true } } },
      })
      .catch(() => null),
  ]);

  // Sacred-tree snapshot: the person's bloomed decisions (title + garden emoji).
  const treeSeeds = await db.seed
    .findMany({
      where: { createdById: userId, deletedAt: null, bloomId: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 18,
      select: { title: true, garden: { select: { emoji: true } } },
    })
    .catch(() => [] as { title: string; garden: { emoji: string } }[]);

  // Latest bloom + the person's own reflection on it, for the Bloom card.
  let latestBloom: ArtefactData["latestBloom"] = null;
  if (latestSeed?.bloomId) {
    const refl = await getMyReflection(userId, latestSeed.bloomId).catch(() => null);
    latestBloom = {
      title: latestSeed.title,
      garden: latestSeed.garden?.name ?? "",
      outcome: refl?.outcome ?? null,
      lesson: (refl?.lesson ?? "").trim(),
      sameAgain: refl?.sameAgain ?? null,
    };
  }

  return {
    name: first,
    seedsPlanted,
    bloomsCount,
    summary,
    judgementInsight: judgementInsight(summary),
    lessonsInsight: lessonsInsight(summary.weight),
    lessons: lessonsRaw
      .filter((l) => l.lesson.trim().length > 0)
      .slice(0, 4)
      .map((l) => ({ lesson: l.lesson.trim(), weight: null })),
    areas: areasRaw
      .filter((a) => a.reflected > 0)
      .slice(0, 4)
      .map((a) => ({
        name: a.name,
        emoji: a.emoji,
        reflected: a.reflected,
        better: a.outcome.better,
        worse: a.outcome.worse,
      })),
    tree: treeSeeds.map((s) => ({ title: s.title, emoji: s.garden?.emoji ?? "🌸" })),
    latestBloom,
  };
}
