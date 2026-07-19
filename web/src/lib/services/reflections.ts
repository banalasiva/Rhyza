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

export type Reflection = {
  outcome: string | null;
  outcomeNote: string | null;
  lesson: string | null;
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
  sameAgain: null,
  changed: null,
  outcomeShared: false,
  lessonShared: false,
  sameAgainShared: false,
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
export type ReflectionSummary = {
  reflected: number; // decisions with an outcome and/or same-again recorded
  outcome: { better: number; expected: number; worse: number };
  sameAgain: { yes: number; unsure: number; no: number };
};

export async function getReflectionSummary(userId: string): Promise<ReflectionSummary> {
  const rows = await db.bloomReflection
    .findMany({
      where: { userId },
      select: { outcome: true, sameAgain: true },
    })
    .catch(() => [] as { outcome: string | null; sameAgain: string | null }[]);

  const outcome = { better: 0, expected: 0, worse: 0 };
  const sameAgain = { yes: 0, unsure: 0, no: 0 };
  let reflected = 0;
  for (const r of rows) {
    if (!r.outcome && !r.sameAgain) continue;
    reflected++;
    if (r.outcome === "better") outcome.better++;
    else if (r.outcome === "expected") outcome.expected++;
    else if (r.outcome === "worse") outcome.worse++;
    if (r.sameAgain === "definitely_yes" || r.sameAgain === "probably_yes") sameAgain.yes++;
    else if (r.sameAgain === "not_sure") sameAgain.unsure++;
    else if (r.sameAgain === "probably_no" || r.sameAgain === "definitely_no") sameAgain.no++;
  }
  return { reflected, outcome, sameAgain };
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
