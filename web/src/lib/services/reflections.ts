import { db } from "@/lib/db";
import { requireSeedAccess } from "@/lib/authz";

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

export type Reflection = {
  outcome: string | null;
  outcomeNote: string | null;
  lesson: string | null;
  sameAgain: string | null;
  changed: string | null;
  updatedAt: string | null;
};

const EMPTY: Reflection = {
  outcome: null,
  outcomeNote: null,
  lesson: null,
  sameAgain: null,
  changed: null,
  updatedAt: null,
};

// The current user's reflection on a bloom (empty shape if none / unavailable).
export async function getMyReflection(userId: string, bloomId: string): Promise<Reflection> {
  const row = await db.bloomReflection
    .findUnique({ where: { bloomId_userId: { bloomId, userId } } })
    .catch(() => null);
  if (!row) return EMPTY;
  return {
    outcome: row.outcome,
    outcomeNote: row.outcomeNote,
    lesson: row.lesson,
    sameAgain: row.sameAgain,
    changed: row.changed,
    updatedAt: row.updatedAt.toISOString(),
  };
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
    sameAgain: string | null;
    changed: string | null;
  }>,
): Promise<Reflection> {
  const bloom = await db.bloom.findUnique({
    where: { id: bloomId },
    select: { id: true, seedId: true },
  });
  if (!bloom) return EMPTY;
  await requireSeedAccess(userId, bloom.seedId);

  const data: Record<string, string | null> = {};
  if ("outcome" in patch) data.outcome = OUTCOMES.includes(patch.outcome as never) ? patch.outcome! : null;
  if ("outcomeNote" in patch) data.outcomeNote = clean(patch.outcomeNote, 2000);
  if ("lesson" in patch) data.lesson = clean(patch.lesson, 2000);
  if ("sameAgain" in patch) data.sameAgain = SAME_AGAIN.includes(patch.sameAgain as never) ? patch.sameAgain! : null;
  if ("changed" in patch) data.changed = clean(patch.changed, 2000);

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
