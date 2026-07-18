import { db } from "@/lib/db";
import { requireSeedAccess } from "@/lib/authz";
import { displayName } from "@/lib/display-name";

// Personal "Keep" — a private bookmark on a message, so anyone can hold on to a
// thought and land back on it later, even after the seed has bloomed. Everything
// here is best-effort against a standalone table (SEV0 discipline): a missing
// table just means Keep quietly does nothing, never an error in the room.

const PREVIEW_MAX = 280;

// Keep a message for the current user. Verifies they can see the seed, then
// stores a small snapshot (author, preview, seed title) so the Kept list stands
// on its own. Idempotent — keeping twice is a no-op.
export async function keepContribution(userId: string, contributionId: string) {
  const c = await db.contribution.findUnique({
    where: { id: contributionId },
    include: {
      author: { select: { name: true, email: true } },
      seed: { select: { id: true, title: true } },
    },
  });
  if (!c || c.deletedAt || !c.seed) return { ok: false as const };
  // Must be allowed to see the seed to keep one of its messages.
  await requireSeedAccess(userId, c.seed.id);

  const content = c.content as { text?: string } | null;
  const preview = (content?.text ?? "").slice(0, PREVIEW_MAX);
  await db.keptContribution
    .upsert({
      where: { userId_contributionId: { userId, contributionId } },
      update: { preview, seedTitle: c.seed.title, authorName: displayName(c.author) },
      create: {
        userId,
        contributionId,
        seedId: c.seed.id,
        seedTitle: c.seed.title,
        authorName: displayName(c.author),
        preview,
      },
    })
    .catch(() => {});
  return { ok: true as const, kept: true };
}

// Un-keep a message. Idempotent.
export async function unkeepContribution(userId: string, contributionId: string) {
  await db.keptContribution
    .delete({ where: { userId_contributionId: { userId, contributionId } } })
    .catch(() => {});
  return { ok: true as const, kept: false };
}

// The set of contribution ids the user has kept within a given seed — used to
// light up the "Kept" state on each message. Best-effort: [] if unavailable.
export async function getKeptIdsForSeed(userId: string, seedId: string): Promise<Set<string>> {
  const rows = await db.keptContribution
    .findMany({ where: { userId, seedId }, select: { contributionId: true } })
    .catch(() => [] as { contributionId: string }[]);
  return new Set(rows.map((r) => r.contributionId));
}

// Whether a single message is kept — for the per-message toggle endpoint.
export async function isKept(userId: string, contributionId: string): Promise<boolean> {
  const row = await db.keptContribution
    .findUnique({ where: { userId_contributionId: { userId, contributionId } }, select: { userId: true } })
    .catch(() => null);
  return !!row;
}

export type KeptItem = {
  contributionId: string;
  seedId: string;
  seedTitle: string;
  authorName: string;
  preview: string;
  createdAt: string;
};

// The user's whole Kept list, newest first — the "saved for myself" view.
export async function listKept(userId: string): Promise<KeptItem[]> {
  const rows = await db.keptContribution
    .findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 200 })
    .catch(() => [] as Awaited<ReturnType<typeof db.keptContribution.findMany>>);
  return rows.map((r) => ({
    contributionId: r.contributionId,
    seedId: r.seedId,
    seedTitle: r.seedTitle,
    authorName: r.authorName,
    preview: r.preview,
    createdAt: r.createdAt.toISOString(),
  }));
}
