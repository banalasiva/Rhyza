import { db } from "@/lib/db";
import { requireSeedAccess } from "@/lib/authz";
import { displayName } from "@/lib/display-name";

// Bloom 2.0 — personal reflection on a decision. A Bloom keeps growing after the
// discussion ends: reality gets a voice (how it turned out vs. what you
// expected), you name the biggest lesson, and — revisiting later — you say
// whether you'd decide the same today. Not a score, a mirror. All best-effort
// against a standalone table so a missing table never breaks a bloom read.

export const OUTCOMES = ["better", "expected", "worse"] as const;
export const SAME_AGAIN = [
  "definitely_yes",
  "probably_yes",
  "not_sure",
  "probably_no",
  "definitely_no",
] as const;
// How hard-won the lesson was — a heat scale from a costly, painful lesson to a
// cheap, mild one.
export const LESSON_WEIGHTS = ["very_tough", "tough", "medium", "easy", "very_easy"] as const;

export type Reflection = {
  outcome: string | null;
  outcomeNote: string | null;
  lesson: string | null;
  lessonWeight: string | null;
  sameAgain: string | null;
  changed: string | null;
  outcomeShared: boolean;
  lessonShared: boolean;
  sameAgainShared: boolean;
  updatedAt: string | null;
};

const EMPTY: Reflection = {
  outcome: null,
  outcomeNote: null,
  lesson: null,
  lessonWeight: null,
  sameAgain: null,
  changed: null,
  outcomeShared: false,
  lessonShared: false,
  sameAgainShared: false,
  updatedAt: null,
};

// Columns that have always existed on bloom_reflections — safe to select even
// on a DB where the newer lesson_weight column hasn't been migrated yet.
const SAFE_SELECT = {
  outcome: true,
  outcomeNote: true,
  lesson: true,
  sameAgain: true,
  changed: true,
  outcomeShared: true,
  lessonShared: true,
  sameAgainShared: true,
  updatedAt: true,
} as const;

// The current user's reflection on a bloom (empty shape if none / unavailable).
// Resilient to the lesson_weight column not being migrated yet: it tries WITH
// that column, then falls back to the always-present columns — so an existing
// reflection is never hidden just because a new column hasn't been added.
type SafeRow = {
  outcome: string | null;
  outcomeNote: string | null;
  lesson: string | null;
  sameAgain: string | null;
  changed: string | null;
  outcomeShared: boolean;
  lessonShared: boolean;
  sameAgainShared: boolean;
  updatedAt: Date;
  lessonWeight?: string | null;
};

export async function getMyReflection(userId: string, bloomId: string): Promise<Reflection> {
  const where = { bloomId_userId: { bloomId, userId } };
  let row: SafeRow | null = null;
  try {
    row = (await db.bloomReflection.findUnique({
      where,
      select: { ...SAFE_SELECT, lessonWeight: true },
    })) as SafeRow | null;
  } catch {
    row = (await db.bloomReflection
      .findUnique({ where, select: SAFE_SELECT })
      .catch(() => null)) as SafeRow | null;
  }
  if (!row) return EMPTY;
  return {
    outcome: row.outcome,
    outcomeNote: row.outcomeNote,
    lesson: row.lesson,
    lessonWeight: row.lessonWeight ?? null,
    sameAgain: row.sameAgain,
    changed: row.changed,
    outcomeShared: row.outcomeShared,
    lessonShared: row.lessonShared,
    sameAgainShared: row.sameAgainShared,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// A section of someone else's reflection they chose to share. Only the shared
// pieces are ever included; each is visible because the viewer can open this
// bloom at all — which the seed's own visibility already gates (private seed →
// its members; public → public). So no extra audience check is needed here.
export type SharedReflection = {
  name: string;
  outcome: string | null;
  outcomeNote: string | null;
  lesson: string | null;
  sameAgain: string | null;
  changed: string | null;
};

export async function getSharedReflections(
  bloomId: string,
  excludeUserId: string,
): Promise<SharedReflection[]> {
  const rows = await db.bloomReflection
    .findMany({
      where: {
        bloomId,
        userId: { not: excludeUserId },
        OR: [{ outcomeShared: true }, { lessonShared: true }, { sameAgainShared: true }],
      },
      take: 200,
    })
    .catch(() => [] as Awaited<ReturnType<typeof db.bloomReflection.findMany>>);
  if (rows.length === 0) return [];

  // Names come from a separate lookup (the table has no FK to users, by design).
  const users = await db.user
    .findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, name: true, email: true },
    })
    .catch(() => [] as { id: string; name: string | null; email: string | null }[]);
  const nameById = new Map(users.map((u) => [u.id, displayName(u)]));

  return rows.map((r) => ({
    name: nameById.get(r.userId) ?? "A member",
    // Each section only surfaces if that section was shared.
    outcome: r.outcomeShared ? r.outcome : null,
    outcomeNote: r.outcomeShared ? r.outcomeNote : null,
    lesson: r.lessonShared ? r.lesson : null,
    sameAgain: r.sameAgainShared ? r.sameAgain : null,
    changed: r.sameAgainShared ? r.changed : null,
  }));
}

const clean = (s: unknown, max: number): string | null => {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t ? t.slice(0, max) : null;
};

// Save (partial-merge) the user's reflection on a bloom. Verifies seed access,
// resolves the bloom's seed, then upserts only the fields provided so each
// section can autosave on its own without clobbering the others.
export async function saveReflection(
  userId: string,
  bloomId: string,
  patch: Partial<{
    outcome: string | null;
    outcomeNote: string | null;
    lesson: string | null;
    lessonWeight: string | null;
    sameAgain: string | null;
    changed: string | null;
    outcomeShared: boolean;
    lessonShared: boolean;
    sameAgainShared: boolean;
  }>,
): Promise<Reflection> {
  const bloom = await db.bloom.findUnique({
    where: { id: bloomId },
    select: { id: true, seedId: true },
  });
  if (!bloom) return EMPTY;
  await requireSeedAccess(userId, bloom.seedId);

  const data: Record<string, string | boolean | null> = {};
  if ("outcome" in patch) data.outcome = OUTCOMES.includes(patch.outcome as never) ? patch.outcome! : null;
  if ("outcomeNote" in patch) data.outcomeNote = clean(patch.outcomeNote, 2000);
  if ("lesson" in patch) data.lesson = clean(patch.lesson, 2000);
  if ("lessonWeight" in patch)
    data.lessonWeight = LESSON_WEIGHTS.includes(patch.lessonWeight as never) ? patch.lessonWeight! : null;
  if ("sameAgain" in patch) data.sameAgain = SAME_AGAIN.includes(patch.sameAgain as never) ? patch.sameAgain! : null;
  if ("changed" in patch) data.changed = clean(patch.changed, 2000);
  if ("outcomeShared" in patch) data.outcomeShared = !!patch.outcomeShared;
  if ("lessonShared" in patch) data.lessonShared = !!patch.lessonShared;
  if ("sameAgainShared" in patch) data.sameAgainShared = !!patch.sameAgainShared;

  await db.bloomReflection
    .upsert({
      where: { bloomId_userId: { bloomId, userId } },
      update: data,
      create: { bloomId, userId, seedId: bloom.seedId, ...data },
    })
    .catch(() => {});
  return getMyReflection(userId, bloomId);
}

export type LessonItem = {
  bloomId: string;
  seedId: string;
  lesson: string;
  outcome: string | null;
  updatedAt: string;
};

// A private mirror (NOT a score) of how the user's decisions have actually
// turned out, and whether they'd stand by them — aggregated across every bloom
// they've reflected on. Surfaces the patterns their own philosophy cares about:
// which calls landed, which assumptions failed, how their judgment is evolving.
export type WeightCounts = {
  very_tough: number;
  tough: number;
  medium: number;
  easy: number;
  very_easy: number;
};
export type ReflectionSummary = {
  reflected: number; // decisions with an outcome and/or same-again recorded
  outcome: { better: number; expected: number; worse: number };
  sameAgain: { yes: number; unsure: number; no: number };
  weight: WeightCounts; // how hard-won the lessons were
};

const emptyWeight = (): WeightCounts => ({
  very_tough: 0,
  tough: 0,
  medium: 0,
  easy: 0,
  very_easy: 0,
});
function tallyWeight(w: WeightCounts, key: string | null) {
  if (key && key in w) w[key as keyof WeightCounts]++;
}

export async function getReflectionSummary(userId: string): Promise<ReflectionSummary> {
  // Resilient to lesson_weight not being migrated yet: try with it, else read
  // the always-present columns so the section never vanishes before a migration.
  let rows: { outcome: string | null; sameAgain: string | null; lessonWeight: string | null }[];
  try {
    rows = await db.bloomReflection.findMany({
      where: { userId },
      select: { outcome: true, sameAgain: true, lessonWeight: true },
    });
  } catch {
    const safe = await db.bloomReflection
      .findMany({ where: { userId }, select: { outcome: true, sameAgain: true } })
      .catch(() => [] as { outcome: string | null; sameAgain: string | null }[]);
    rows = safe.map((r) => ({ ...r, lessonWeight: null }));
  }

  const outcome = { better: 0, expected: 0, worse: 0 };
  const sameAgain = { yes: 0, unsure: 0, no: 0 };
  const weight = emptyWeight();
  let reflected = 0;
  for (const r of rows) {
    tallyWeight(weight, r.lessonWeight);
    if (!r.outcome && !r.sameAgain && !r.lessonWeight) continue;
    reflected++;
    if (r.outcome === "better") outcome.better++;
    else if (r.outcome === "expected") outcome.expected++;
    else if (r.outcome === "worse") outcome.worse++;
    if (r.sameAgain === "definitely_yes" || r.sameAgain === "probably_yes") sameAgain.yes++;
    else if (r.sameAgain === "not_sure") sameAgain.unsure++;
    else if (r.sameAgain === "probably_no" || r.sameAgain === "definitely_no") sameAgain.no++;
  }
  return { reflected, outcome, sameAgain, weight };
}

// The same mirror, split BY AREA — one summary per garden the person has
// reflected in (a garden is ThinkThru's unit of topic: Hiring, Product, Money…).
// Lets someone see that their, say, product calls land well but their hiring
// calls keep surprising them. Best-effort; garden looked up separately (no FK).
export type AreaSummary = ReflectionSummary & {
  gardenId: string;
  name: string;
  emoji: string;
};

export async function getReflectionsByArea(userId: string): Promise<AreaSummary[]> {
  const rows = await db.bloomReflection
    .findMany({
      where: {
        userId,
        OR: [{ outcome: { not: null } }, { sameAgain: { not: null } }, { lessonWeight: { not: null } }],
      },
      select: { outcome: true, sameAgain: true, lessonWeight: true, bloomId: true },
    })
    .catch(
      () =>
        [] as {
          outcome: string | null;
          sameAgain: string | null;
          lessonWeight: string | null;
          bloomId: string;
        }[],
    );
  if (rows.length === 0) return [];

  const blooms = await db.bloom
    .findMany({
      where: { id: { in: rows.map((r) => r.bloomId) } },
      select: { id: true, garden: { select: { id: true, name: true, emoji: true } } },
    })
    .catch(
      () => [] as { id: string; garden: { id: string; name: string; emoji: string } | null }[],
    );
  const gardenByBloom = new Map(blooms.map((b) => [b.id, b.garden]));

  const map = new Map<string, AreaSummary>();
  for (const r of rows) {
    const g = gardenByBloom.get(r.bloomId);
    if (!g) continue;
    let a = map.get(g.id);
    if (!a) {
      a = {
        gardenId: g.id,
        name: g.name,
        emoji: g.emoji,
        reflected: 0,
        outcome: { better: 0, expected: 0, worse: 0 },
        sameAgain: { yes: 0, unsure: 0, no: 0 },
        weight: emptyWeight(),
      };
      map.set(g.id, a);
    }
    tallyWeight(a.weight, r.lessonWeight);
    if (!r.outcome && !r.sameAgain && !r.lessonWeight) continue;
    a.reflected++;
    if (r.outcome === "better") a.outcome.better++;
    else if (r.outcome === "expected") a.outcome.expected++;
    else if (r.outcome === "worse") a.outcome.worse++;
    if (r.sameAgain === "definitely_yes" || r.sameAgain === "probably_yes") a.sameAgain.yes++;
    else if (r.sameAgain === "not_sure") a.sameAgain.unsure++;
    else if (r.sameAgain === "probably_no" || r.sameAgain === "definitely_no") a.sameAgain.no++;
  }
  return [...map.values()].sort((a, b) => b.reflected - a.reflected);
}

// A plain-language read of the pattern — the "calibration insight". Still a
// mirror, not a score: it names the tendency (optimistic? well-calibrated? do
// you stand by your calls?) so a person can SEE how their judgment leans and
// evolves. Deterministic (no AI), returns null until there's enough to say.
export function judgementInsight(s: ReflectionSummary): string | null {
  const { outcome, sameAgain, weight } = s;
  const oTotal = outcome.better + outcome.expected + outcome.worse;
  const sTotal = sameAgain.yes + sameAgain.unsure + sameAgain.no;
  const parts: string[] = [];

  if (oTotal >= 2) {
    if (outcome.expected >= outcome.better + outcome.worse) {
      parts.push("Your expectations track reality closely — a well-calibrated read.");
    } else if (outcome.worse > outcome.better) {
      parts.push("Reality tends to land harder than you expect — a touch of optimism in your calls.");
    } else if (outcome.better > outcome.worse) {
      parts.push("Things tend to turn out better than you brace for — you may be underselling yourself.");
    } else {
      parts.push("A real mix — some calls land as planned, some surprise you.");
    }
  }

  if (sTotal >= 2) {
    if (sameAgain.no === 0 && sameAgain.yes > 0) {
      parts.push("And you'd stand by all of them, so far.");
    } else if (sameAgain.no > 0) {
      parts.push(
        `You'd redo ${sameAgain.no} of them — that's judgment sharpening, not failing.`,
      );
    } else {
      parts.push("A few you're still weighing.");
    }
  }

  const wTotal =
    weight.very_tough + weight.tough + weight.medium + weight.easy + weight.very_easy;
  if (wTotal >= 2) {
    const hard = weight.very_tough + weight.tough;
    const soft = weight.easy + weight.very_easy;
    if (hard > soft) parts.push("Your lessons have been hard-won.");
    else if (soft > hard) parts.push("Most of your lessons came gently.");
  }

  return parts.length ? parts.join(" ") : null;
}

export type ReflectionListItem = {
  bloomId: string;
  seedId: string;
  title: string;
  outcome: string | null;
  sameAgain: string | null;
  lesson: string | null;
  lessonWeight: string | null;
  updatedAt: string;
};

// Every decision the user has looked back on (any of outcome / same-again /
// lesson set), newest first — powers the dedicated Judgement view. Bloom titles
// come from a separate lookup (the table has no FK, by design). Best-effort.
export async function listMyReflections(userId: string): Promise<ReflectionListItem[]> {
  const rows = await db.bloomReflection
    .findMany({
      where: {
        userId,
        OR: [{ outcome: { not: null } }, { sameAgain: { not: null } }, { lesson: { not: null } }],
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    })
    .catch(() => [] as Awaited<ReturnType<typeof db.bloomReflection.findMany>>);
  if (rows.length === 0) return [];

  const blooms = await db.bloom
    .findMany({ where: { id: { in: rows.map((r) => r.bloomId) } }, select: { id: true, title: true } })
    .catch(() => [] as { id: string; title: string }[]);
  const titleById = new Map(blooms.map((b) => [b.id, b.title]));

  return rows.map((r) => ({
    bloomId: r.bloomId,
    seedId: r.seedId,
    title: titleById.get(r.bloomId) ?? "A decision",
    outcome: r.outcome,
    sameAgain: r.sameAgain,
    lesson: r.lesson?.trim() || null,
    lessonWeight: r.lessonWeight,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

// Every lesson the user has drawn, newest first — the compounding "wisdom" of
// their Garden, surfaced on their roots/profile. Best-effort.
export async function listMyLessons(userId: string): Promise<LessonItem[]> {
  const rows = await db.bloomReflection
    .findMany({
      where: { userId, NOT: { lesson: null } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    })
    .catch(() => [] as Awaited<ReturnType<typeof db.bloomReflection.findMany>>);
  return rows
    .filter((r) => (r.lesson ?? "").trim())
    .map((r) => ({
      bloomId: r.bloomId,
      seedId: r.seedId,
      lesson: r.lesson as string,
      outcome: r.outcome,
      updatedAt: r.updatedAt.toISOString(),
    }));
}
