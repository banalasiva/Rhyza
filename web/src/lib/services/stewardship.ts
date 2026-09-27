import { db } from "@/lib/db";
import { classifyStewardship } from "@/lib/ai";
import { recognizeContribution } from "@/lib/services/recognition";
import { deliver } from "@/lib/services/notify";
import { displayName } from "@/lib/display-name";

// ── Conflict stewardship (Path C: AI spotlights, a human certifies) ─────────
// When someone replies to another person's point in a way that genuinely takes
// it seriously, the classifier records a SPOTLIGHT aimed at the person who was
// challenged — the only one who can honestly confirm "yes, they heard me out".
// On confirm it becomes a peer recognition (tension_holder). The AI never awards
// the credit; it only surfaces the candidate moment. Everything is best-effort:
// a missing table or a bad id must never throw into the post/seed path.

const AI_NAMES = new Set(["Claude", "ChatGPT"]);
const textOf = (content: unknown): string =>
  ((content as { text?: string } | null)?.text ?? "").trim();

// Fire-and-forget from the reply's create path. Only spotlights a reply that
// engages a DIFFERENT, human author's point — never yourself, never an AI.
export async function spotlightStewardship(input: {
  seedId: string;
  contributionId: string; // the reply that may have held the tension
  replierId: string;
  parentId: string; // the point being replied to
}): Promise<void> {
  try {
    const [reply, parent] = await Promise.all([
      db.contribution.findUnique({
        where: { id: input.contributionId },
        select: { content: true },
      }),
      db.contribution.findUnique({
        where: { id: input.parentId },
        select: { authorId: true, content: true, author: { select: { name: true } } },
      }),
    ]);
    if (!reply || !parent) return;

    const targetId = parent.authorId;
    if (targetId === input.replierId) return; // replying to yourself
    if (AI_NAMES.has(parent.author?.name ?? "")) return; // engaging an AI, not a peer

    const point = textOf(parent.content);
    const replyText = textOf(reply.content);
    if (!point || !replyText) return;

    // The strict, cheap classifier — the SPOTLIGHT, not the verdict.
    if (!(await classifyStewardship({ point, reply: replyText }))) return;

    const created = await db.stewardshipSpotlight
      .upsert({
        where: { contributionId_targetId: { contributionId: input.contributionId, targetId } },
        update: {},
        create: {
          seedId: input.seedId,
          contributionId: input.contributionId,
          replierId: input.replierId,
          targetId,
          status: "pending",
        },
      })
      .catch(() => null);
    if (!created) return;

    await notifyStewardship(input.seedId, input.contributionId, input.replierId, targetId).catch(
      () => {},
    );
  } catch (err) {
    console.error("spotlightStewardship failed", err);
  }
}

// Ping the challenged person that there's a moment to certify. Best-effort.
async function notifyStewardship(
  seedId: string,
  contributionId: string,
  replierId: string,
  targetId: string,
) {
  const replier = await db.user
    .findUnique({ where: { id: replierId }, select: { name: true, email: true } })
    .catch(() => null);
  const who = replier ? displayName(replier) : "Someone";
  const title = "Did they take your point seriously? 🪢";
  const body = `${who} engaged what you said — open the thread to say whether they took it seriously.`;
  const notif = await db.notification
    .create({
      data: {
        recipientId: targetId,
        actorId: replierId,
        type: "stewardship",
        title,
        body,
        entityType: "seed",
        entityId: seedId,
      },
    })
    .catch(() => null);
  if (!notif) return;
  await deliver([
    {
      notificationId: notif.id,
      recipientId: targetId,
      type: "stewardship",
      push: { title, body },
      link: `/seeds/${seedId}#c-${contributionId}`,
    },
  ]).catch(() => {});
}

export type PendingStewardship = {
  spotlightId: string;
  contributionId: string;
  replierName: string;
};

// The certify prompts the viewer should see in this seed — pending spotlights
// where THEY are the challenged person. Best-effort; empty on any failure.
export async function getPendingStewardship(
  seedId: string,
  viewerId: string,
): Promise<PendingStewardship[]> {
  const rows = await db.stewardshipSpotlight
    .findMany({
      where: { seedId, targetId: viewerId, status: "pending" },
      select: { id: true, contributionId: true, replierId: true },
    })
    .catch(() => [] as { id: string; contributionId: string; replierId: string }[]);
  if (rows.length === 0) return [];
  const repliers = await db.user
    .findMany({
      where: { id: { in: rows.map((r) => r.replierId) } },
      select: { id: true, name: true, email: true },
    })
    .catch(() => [] as { id: string; name: string | null; email: string | null }[]);
  const nameById = new Map(repliers.map((u) => [u.id, displayName(u)]));
  return rows.map((r) => ({
    spotlightId: r.id,
    contributionId: r.contributionId,
    replierName: nameById.get(r.replierId) ?? "Someone",
  }));
}

// The certification — the un-gameable step. Only the challenged person (target)
// can confirm, and confirming records the tension_holder recognition on the
// reply, BY them. Declining just closes the spotlight, quietly.
export async function certifyStewardship(
  userId: string,
  spotlightId: string,
  confirmed: boolean,
): Promise<{ ok: boolean }> {
  const spot = await db.stewardshipSpotlight
    .findUnique({ where: { id: spotlightId } })
    .catch(() => null);
  if (!spot) return { ok: false };
  if (spot.targetId !== userId) return { ok: false }; // only the challenged person may certify
  if (spot.status !== "pending") return { ok: true }; // already answered
  await db.stewardshipSpotlight
    .update({ where: { id: spotlightId }, data: { status: confirmed ? "confirmed" : "declined" } })
    .catch(() => {});
  if (confirmed) {
    await recognizeContribution(userId, spot.contributionId, "tension_holder").catch(() => {});
  }
  return { ok: true };
}
