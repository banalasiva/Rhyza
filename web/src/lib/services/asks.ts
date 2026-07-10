import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireSeedAccess } from "@/lib/authz";
import { listMyNetwork } from "@/lib/services/members";
import { deliver } from "@/lib/services/notify";

// Direct "asks" — the interpersonal pull. You point a seed at specific people by
// name ("Sreedevi, what do you think?"), and they get a personal summons, not a
// group ping. It's the single strongest reason a high-intent person comes back:
// something is waiting on THEM, from someone they know. When they contribute to
// the seed, the ask is answered and the asker hears about it — the rally.

const AI_NAMES = ["Claude", "ChatGPT"];

// Ask one or more people (already in your circle) to weigh in on a seed. Adds
// them to the seed so they can open it, records the ask, and sends each a warm
// personal push. Returns how many were actually asked.
export async function askOnSeed(
  askerId: string,
  seedId: string,
  askedIds: string[],
): Promise<{ asked: number }> {
  await requireSeedAccess(askerId, seedId);

  const seed = await db.seed.findUnique({
    where: { id: seedId },
    select: { id: true, title: true, gardenId: true, createdById: true, deletedAt: true },
  });
  if (!seed || seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");

  const garden = await db.garden.findUnique({
    where: { id: seed.gardenId },
    select: { id: true, orgId: true },
  });
  if (!garden) throw new ApiError("NOT_FOUND", "Garden not found");

  const asker = await db.user.findUnique({ where: { id: askerId }, select: { name: true } });
  const askerName = asker?.name?.trim() || "Someone";

  // Only people you've actually connected with, and who belong to this space —
  // same guard as adding a member, so an ask can't leak a private seed.
  const network = await listMyNetwork(askerId);
  const inCircle = new Set(network.map((p) => p.id));

  const targets = [...new Set(askedIds)].filter((id) => id && id !== askerId);
  let asked = 0;

  for (const targetId of targets) {
    if (!inCircle.has(targetId)) continue;
    const inOrg = await db.orgMember
      .findUnique({
        where: { orgId_userId: { orgId: garden.orgId, userId: targetId } },
        select: { userId: true },
      })
      .catch(() => null);
    if (!inOrg) continue;

    // Give them access to the seed (and the garden it lives in). Upserts — a
    // no-op if they're already in, and it never re-notifies "you were added".
    try {
      await db.$transaction([
        db.gardenMember.upsert({
          where: { gardenId_userId: { gardenId: garden.id, userId: targetId } },
          update: {},
          create: { gardenId: garden.id, userId: targetId },
        }),
        db.seedMember.upsert({
          where: { seedId_userId: { seedId, userId: targetId } },
          update: {},
          create: { seedId, userId: targetId, role: "member" },
        }),
      ]);
    } catch (err) {
      console.error("askOnSeed: membership upsert failed", err);
      continue;
    }

    // Record the ask (re-asking reopens it so it resurfaces in "It's your turn").
    try {
      await db.seedAsk.upsert({
        where: { seedId_askedId: { seedId, askedId: targetId } },
        update: { askerId, answeredAt: null, createdAt: new Date() },
        create: { seedId, askerId, askedId: targetId },
      });
    } catch (err) {
      console.error("askOnSeed: ask upsert failed", err);
      continue;
    }

    // The personal summons.
    const title = `${askerName} is asking for your take 🌱`;
    const body = `“${seed.title.slice(0, 90)}”`;
    try {
      const note = await db.notification.create({
        data: {
          recipientId: targetId,
          actorId: askerId,
          type: "ask",
          title,
          body,
          entityType: "seed",
          entityId: seedId,
        },
        select: { id: true },
      });
      await deliver([
        { notificationId: note.id, recipientId: targetId, type: "ask", push: { title, body }, link: `/seeds/${seedId}` },
      ]);
    } catch (err) {
      console.error("askOnSeed: notify failed", err);
    }
    asked++;
  }

  return { asked };
}

// When someone contributes to a seed, close any open ask addressed to them and
// tell whoever asked. Called from addContribution — best-effort, never blocks.
export async function markAsksAnswered(seedId: string, userId: string): Promise<void> {
  try {
    const open = (await db.seedAsk.findMany({
      where: { seedId, askedId: userId, answeredAt: null },
      select: { id: true, askerId: true },
    })) as { id: string; askerId: string }[];
    if (open.length === 0) return;

    await db.seedAsk.updateMany({
      where: { id: { in: open.map((a) => a.id) } },
      data: { answeredAt: new Date() },
    });

    const [seed, answerer] = await Promise.all([
      db.seed.findUnique({ where: { id: seedId }, select: { title: true } }),
      db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
    const name = answerer?.name?.trim() || "Someone";
    const askerIds = [...new Set(open.map((a) => a.askerId))].filter((id) => id !== userId);
    if (askerIds.length === 0) return;

    const title = `${name} answered your ask ✅`;
    const body = `“${(seed?.title ?? "your question").slice(0, 90)}”`;
    const notes = await Promise.all(
      askerIds.map((rid) =>
        db.notification
          .create({
            data: {
              recipientId: rid,
              actorId: userId,
              type: "ask_answered",
              title,
              body,
              entityType: "seed",
              entityId: seedId,
            },
            select: { id: true, recipientId: true },
          })
          .catch(() => null),
      ),
    );
    await deliver(
      notes
        .filter((n): n is { id: string; recipientId: string } => !!n)
        .map((n) => ({
          notificationId: n.id,
          recipientId: n.recipientId,
          type: "ask_answered",
          push: { title, body },
          link: `/seeds/${seedId}`,
        })),
    );
  } catch (err) {
    console.error("markAsksAnswered failed", err);
  }
}
