import { db } from "@/lib/db";
import { requireSeedAccess } from "@/lib/authz";
import { deserializeMentions } from "@/lib/mentions";

// Unsent message drafts. Everything here is BEST-EFFORT: a missing seed_drafts
// table (un-migrated deploy) must never break typing, sending, or opening a
// seed — every call swallows its own errors. The client's localStorage copy is
// the offline-first source of truth for autofill; this server copy powers the
// "drafts" list in notifications and cross-device continuity.

export type DraftAttachment = { url: string; type: string; name?: string };

// Save (or clear) the draft for a (seed, user). Empty text + no attachments
// deletes it, so a draft never lingers once the box is emptied. Requires seed
// access so you can't write a draft into a seed you can't see.
export async function saveDraft(
  userId: string,
  seedId: string,
  text: string,
  attachments: DraftAttachment[] = [],
) {
  await requireSeedAccess(userId, seedId);
  const clean = (text ?? "").slice(0, 20000);
  const atts = Array.isArray(attachments) ? attachments.slice(0, 10) : [];
  try {
    if (!clean.trim() && atts.length === 0) {
      await db.seedDraft.deleteMany({ where: { seedId, userId } });
      return { ok: true, cleared: true };
    }
    await db.seedDraft.upsert({
      where: { seedId_userId: { seedId, userId } },
      update: { text: clean, attachments: atts },
      create: { seedId, userId, text: clean, attachments: atts },
    });
  } catch (err) {
    console.error("saveDraft failed", err);
  }
  return { ok: true };
}

export async function clearDraft(userId: string, seedId: string) {
  try {
    await db.seedDraft.deleteMany({ where: { seedId, userId } });
  } catch (err) {
    console.error("clearDraft failed", err);
  }
  return { ok: true };
}

// The current server draft for a (seed, user), or null. Best-effort — a missing
// table just yields null so getSeedDetail never fails because of it.
export async function getDraft(
  userId: string,
  seedId: string,
): Promise<{ text: string; attachments: DraftAttachment[] } | null> {
  const row = await db.seedDraft
    .findUnique({ where: { seedId_userId: { seedId, userId } }, select: { text: true, attachments: true } })
    .catch(() => null);
  if (!row) return null;
  const text = row.text ?? "";
  const attachments = Array.isArray(row.attachments) ? (row.attachments as DraftAttachment[]) : [];
  if (!text.trim() && attachments.length === 0) return null;
  return { text, attachments };
}

export type DraftListItem = {
  seedId: string;
  seedTitle: string;
  gardenId: string;
  preview: string;
  hasAttachments: boolean;
  updatedAt: string;
};

// Every seed the person has an unsent draft in — for the "Drafts" section in
// notifications. Best-effort; returns [] if the table isn't there yet. Skips
// drafts whose seed is gone/deleted/bloomed (nothing to go back to).
export async function listMyDrafts(userId: string, cap = 30): Promise<DraftListItem[]> {
  const rows = await db.seedDraft
    .findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: cap,
      select: { seedId: true, text: true, attachments: true, updatedAt: true },
    })
    .catch(() => [] as { seedId: string; text: string; attachments: unknown; updatedAt: Date }[]);
  if (rows.length === 0) return [];

  // SeedDraft is a standalone table (no relation), so join seed titles with one
  // batched query rather than a per-row lookup. Only seeds that still exist.
  const seedIds = rows.map((r) => r.seedId);
  const seeds = await db.seed
    .findMany({
      where: { id: { in: seedIds }, deletedAt: null },
      select: { id: true, title: true, gardenId: true },
    })
    .catch(() => [] as { id: string; title: string; gardenId: string }[]);
  const seedById = new Map(seeds.map((s) => [s.id, s]));

  const out: DraftListItem[] = [];
  for (const r of rows) {
    const seed = seedById.get(r.seedId);
    if (!seed) continue; // seed gone/deleted
    const text = r.text ?? "";
    const atts = Array.isArray(r.attachments) ? (r.attachments as DraftAttachment[]) : [];
    if (!text.trim() && atts.length === 0) continue;
    const preview = deserializeMentions(text).replace(/\s+/g, " ").trim().slice(0, 140);
    out.push({
      seedId: r.seedId,
      seedTitle: seed.title,
      gardenId: seed.gardenId,
      preview,
      hasAttachments: atts.length > 0,
      updatedAt: r.updatedAt.toISOString(),
    });
  }
  return out;
}
