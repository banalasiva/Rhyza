import { db } from "@/lib/db";
import { aiConfigured, senseRoom } from "@/lib/ai";

// The wise presence, sensing the room. After a message lands we occasionally take
// a cheap, fast read of the recent exchange; if it's genuinely getting rough or
// the thinking has drifted, we raise a gentle OFFER that everyone sees and anyone
// can accept. Heavily throttled and conservative — a presence that speaks too
// often is noise, not wisdom.

const AI_NAMES = ["Claude", "ChatGPT"];
const SENSE_COOLDOWN_MS = Number(process.env.MEDIATOR_SENSE_COOLDOWN_MS || 4 * 60 * 1000);
const MIN_HUMAN_MESSAGES = 3;

export type MediatorNudge = { mode: "peace" | "guide"; reason: string };

// The live offer on a seed, if any (mode set = there's something to offer).
export async function getMediatorNudge(seedId: string): Promise<MediatorNudge | null> {
  try {
    const row = await db.seedMediatorNudge.findUnique({
      where: { seedId },
      select: { mode: true, reason: true },
    });
    if (row?.mode === "peace" || row?.mode === "guide") {
      return { mode: row.mode, reason: row.reason ?? "" };
    }
    return null;
  } catch {
    return null; // table not migrated yet
  }
}

// Clear the current offer (someone accepted, or declined it).
export async function resolveMediatorNudge(seedId: string): Promise<void> {
  try {
    await db.seedMediatorNudge.upsert({
      where: { seedId },
      create: { seedId, mode: null, reason: null, sensedAt: new Date() },
      update: { mode: null, reason: null },
    });
  } catch {
    /* best-effort */
  }
}

// Take a read of the room — throttled — and raise/clear an offer accordingly.
// Called (fire-and-forget) after a human message. Never throws.
export async function maybeSenseRoom(seedId: string): Promise<void> {
  if (!aiConfigured()) return;
  try {
    const existing = await db.seedMediatorNudge
      .findUnique({ where: { seedId }, select: { mode: true, sensedAt: true } })
      .catch(() => null);
    // Don't pile a new sense on top of a live offer, and respect the cooldown.
    if (existing?.mode === "peace" || existing?.mode === "guide") return;
    if (existing && Date.now() - new Date(existing.sensedAt).getTime() < SENSE_COOLDOWN_MS) return;

    const rows = (await db.contribution.findMany({
      where: { seedId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { content: true, author: { select: { name: true } } },
      take: 200,
    })) as { content: unknown; author: { name: string | null } }[];

    const human = rows.filter((r) => !AI_NAMES.includes(r.author.name ?? ""));
    if (human.length < MIN_HUMAN_MESSAGES) {
      // Not enough to judge — just stamp the throttle so we don't re-check constantly.
      await stampSense(seedId, null, null);
      return;
    }

    const seed = await db.seed.findUnique({ where: { id: seedId }, select: { title: true } });
    const transcript = rows
      .slice(-10)
      .map((r) => {
        const text = ((r.content as { text?: string } | null)?.text ?? "").trim();
        return text ? `${r.author.name || "A member"}: ${text.slice(0, 400)}` : "";
      })
      .filter(Boolean)
      .join("\n");
    if (!transcript) {
      await stampSense(seedId, null, null);
      return;
    }

    const { mode, reason } = await senseRoom({ title: seed?.title ?? "", transcript });
    await stampSense(seedId, mode === "none" ? null : mode, mode === "none" ? null : reason);
  } catch (err) {
    console.error("maybeSenseRoom failed", err);
  }
}

async function stampSense(seedId: string, mode: string | null, reason: string | null) {
  await db.seedMediatorNudge
    .upsert({
      where: { seedId },
      create: { seedId, mode, reason, sensedAt: new Date() },
      update: { mode, reason, sensedAt: new Date() },
    })
    .catch(() => {});
}
