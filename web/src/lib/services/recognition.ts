import { db } from "@/lib/db";
import { VIRTUES, isVirtue } from "@/lib/recognition";

// Peer recognition: you credit a person for a virtue (depth/judgement/taste/
// empathy) IN CONTEXT on one of their messages. Everything here is best-effort —
// a missing table or a bad id must never throw into a seed or profile read.

// Give recognition. Guards: real virtue, real non-deleted message, not your own,
// not an AI/system author. Idempotent per (message, giver, virtue).
export async function recognizeContribution(
  byId: string,
  contributionId: string,
  virtue: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!isVirtue(virtue)) return { ok: false, reason: "bad_virtue" };
  const c = await db.contribution
    .findUnique({ where: { id: contributionId }, select: { authorId: true, deletedAt: true } })
    .catch(() => null);
  if (!c || c.deletedAt) return { ok: false, reason: "not_found" };
  if (c.authorId === byId) return { ok: false, reason: "self" };
  await db.contributionRecognition
    .upsert({
      where: { contributionId_byId_virtue: { contributionId, byId, virtue } },
      update: {},
      create: { contributionId, authorId: c.authorId, byId, virtue },
    })
    .catch(() => {});
  return { ok: true };
}

export async function unrecognizeContribution(byId: string, contributionId: string, virtue: string) {
  await db.contributionRecognition
    .deleteMany({ where: { contributionId, byId, virtue } })
    .catch(() => {});
  return { ok: true };
}

// For the message action sheet: total count per virtue on this message, and
// which the viewer has given. Fetched on demand when the sheet opens, so this
// never touches the hot seed-thread payload.
export async function getContributionRecognition(
  contributionId: string,
  viewerId: string,
): Promise<{ counts: Record<string, number>; mine: string[] }> {
  const rows = await db.contributionRecognition
    .findMany({ where: { contributionId }, select: { virtue: true, byId: true } })
    .catch(() => [] as { virtue: string; byId: string }[]);
  const counts: Record<string, number> = {};
  const mine: string[] = [];
  for (const r of rows) {
    counts[r.virtue] = (counts[r.virtue] ?? 0) + 1;
    if (r.byId === viewerId) mine.push(r.virtue);
  }
  return { counts, mine };
}

// For the profile: per virtue, how many DISTINCT people have recognized this
// person for it (distinct, so one enthusiastic friend can't inflate a virtue).
// Ordered by the canonical virtue order; only virtues with at least one person.
export async function getUserRecognitionSummary(
  userId: string,
): Promise<{ key: string; label: string; emoji: string; people: number }[]> {
  const rows = await db.contributionRecognition
    .findMany({ where: { authorId: userId }, select: { virtue: true, byId: true } })
    .catch(() => [] as { virtue: string; byId: string }[]);
  const givers = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!givers.has(r.virtue)) givers.set(r.virtue, new Set());
    givers.get(r.virtue)!.add(r.byId);
  }
  return VIRTUES.map((v) => ({
    key: v.key,
    label: v.label,
    emoji: v.emoji,
    people: givers.get(v.key)?.size ?? 0,
  })).filter((v) => v.people > 0);
}
