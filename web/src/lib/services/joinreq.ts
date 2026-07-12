import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireSeedManager } from "@/lib/authz";
import { deliver } from "@/lib/services/notify";
import { announceJoin } from "@/lib/services/seed-notify";

// Request-to-join for private seeds. A shared link only lets someone knock:
// they land on a locked preview and request in; the owner/stewards approve or
// decline. This is what makes a leaked link harmless — access is a granted
// membership, never mere link possession.

export type JoinStatus = "member" | "pending" | "declined" | "none";

type SeedRow = {
  id: string;
  title: string;
  createdById: string;
  gardenId: string;
  visibility: string;
  deletedAt: Date | null;
};

async function loadSeed(seedId: string): Promise<SeedRow | null> {
  const s = (await db.seed
    .findUnique({
      where: { id: seedId },
      select: {
        id: true,
        title: true,
        createdById: true,
        gardenId: true,
        visibility: true,
        deletedAt: true,
      },
    })
    .catch(() => null)) as SeedRow | null;
  return s;
}

// Who can approve: the seed's creator and its stewards (seed admins).
async function seedManagerIds(seed: SeedRow): Promise<string[]> {
  const stewards = (await db.seedMember
    .findMany({ where: { seedId: seed.id, role: "steward" }, select: { userId: true } })
    .catch(() => [])) as { userId: string }[];
  return [...new Set([seed.createdById, ...stewards.map((s) => s.userId)])];
}

// Where does this person stand with a seed?
export async function getJoinStatus(userId: string, seedId: string): Promise<JoinStatus> {
  try {
    const seed = await loadSeed(seedId);
    if (!seed) return "none";
    if (seed.createdById === userId) return "member";
    const member = await db.seedMember
      .findUnique({ where: { seedId_userId: { seedId, userId } }, select: { userId: true } })
      .catch(() => null);
    if (member) return "member";
    const req = await db.seedJoinRequest
      .findUnique({ where: { seedId_userId: { seedId, userId } }, select: { status: true } })
      .catch(() => null);
    if (req?.status === "pending") return "pending";
    if (req?.status === "declined") return "declined";
    return "none";
  } catch {
    return "none";
  }
}

// Knock on a private seed. Records a pending request and pings the owner/stewards.
export async function requestToJoin(
  userId: string,
  seedId: string,
): Promise<{ status: JoinStatus }> {
  const seed = await loadSeed(seedId);
  if (!seed || seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");

  // Already in? Nothing to request.
  const status = await getJoinStatus(userId, seedId);
  if (status === "member") return { status: "member" };

  await db.seedJoinRequest.upsert({
    where: { seedId_userId: { seedId, userId } },
    create: { seedId, userId, status: "pending" },
    update: { status: "pending", decidedAt: null },
  });

  // Notify the people who can let them in.
  try {
    const [managers, who] = await Promise.all([
      seedManagerIds(seed),
      db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
    const recipients = managers.filter((id) => id !== userId);
    if (recipients.length) {
      const name = who?.name || "Someone";
      const title = `${name} wants to join 🌱`;
      const body = `“${seed.title}” — approve or decline`;
      const start = new Date();
      await db.notification.createMany({
        data: recipients.map((rid) => ({
          recipientId: rid,
          actorId: userId,
          type: "join_request",
          title,
          body,
          entityType: "seed",
          entityId: seedId,
        })),
      });
      const rows = (await db.notification.findMany({
        where: { type: "join_request", entityId: seedId, actorId: userId, recipientId: { in: recipients }, createdAt: { gte: start } },
        select: { id: true, recipientId: true },
      })) as { id: string; recipientId: string }[];
      await deliver(
        rows.map((r) => ({
          notificationId: r.id,
          recipientId: r.recipientId,
          type: "join_request",
          push: { title, body },
          link: `/seeds/${seedId}`,
        })),
      );
    }
  } catch (err) {
    console.error("requestToJoin notify failed", err);
  }

  return { status: "pending" };
}

export type JoinRequestPerson = { id: string; name: string; image: string | null; requestedAt: Date };

// The pending knocks on a seed — for the owner/stewards to act on.
export async function listJoinRequests(actorId: string, seedId: string): Promise<JoinRequestPerson[]> {
  await requireSeedManager(actorId, seedId);
  const reqs = (await db.seedJoinRequest
    .findMany({
      where: { seedId, status: "pending" },
      orderBy: { createdAt: "asc" },
      select: { userId: true, createdAt: true },
    })
    .catch(() => [])) as { userId: string; createdAt: Date }[];
  if (reqs.length === 0) return [];
  const users = (await db.user.findMany({
    where: { id: { in: reqs.map((r) => r.userId) } },
    select: { id: true, name: true, image: true },
  })) as { id: string; name: string | null; image: string | null }[];
  const byId = new Map(users.map((u) => [u.id, u]));
  return reqs
    .map((r) => {
      const u = byId.get(r.userId);
      return u ? { id: u.id, name: u.name || "Someone", image: u.image, requestedAt: r.createdAt } : null;
    })
    .filter((x): x is JoinRequestPerson => !!x);
}

export async function countPendingJoinRequests(seedId: string): Promise<number> {
  return db.seedJoinRequest.count({ where: { seedId, status: "pending" } }).catch(() => 0);
}

// Approve → add them as a member (garden + seed) and tell them; decline → close it.
export async function resolveJoinRequest(
  actorId: string,
  seedId: string,
  targetUserId: string,
  approve: boolean,
): Promise<{ ok: true }> {
  const seed = await requireSeedManager(actorId, seedId);
  const req = await db.seedJoinRequest
    .findUnique({ where: { seedId_userId: { seedId, userId: targetUserId } } })
    .catch(() => null);
  if (!req) throw new ApiError("NOT_FOUND", "No such request");

  if (approve) {
    // Private gardens gate on org + garden membership, so grant all three.
    const garden = await db.garden.findUnique({
      where: { id: seed.gardenId },
      select: { orgId: true },
    });
    await db.$transaction([
      ...(garden
        ? [
            db.orgMember.upsert({
              where: { orgId_userId: { orgId: garden.orgId, userId: targetUserId } },
              update: {},
              create: { orgId: garden.orgId, userId: targetUserId, role: "member" },
            }),
          ]
        : []),
      db.gardenMember.upsert({
        where: { gardenId_userId: { gardenId: seed.gardenId, userId: targetUserId } },
        update: {},
        create: { gardenId: seed.gardenId, userId: targetUserId },
      }),
      db.seedMember.upsert({
        where: { seedId_userId: { seedId, userId: targetUserId } },
        update: {},
        create: { seedId, userId: targetUserId, role: "member" },
      }),
      db.seedJoinRequest.update({
        where: { seedId_userId: { seedId, userId: targetUserId } },
        data: { status: "approved", decidedAt: new Date() },
      }),
    ]);
    // Tell them they're in.
    try {
      const title = "You're in 🌱";
      const body = `You've been let into “${(seed as { title?: string }).title ?? "a seed"}”`;
      const note = await db.notification.create({
        data: { recipientId: targetUserId, actorId, type: "join_approved", title, body, entityType: "seed", entityId: seedId },
        select: { id: true },
      });
      await deliver([
        { notificationId: note.id, recipientId: targetUserId, type: "join_approved", push: { title, body }, link: `/seeds/${seedId}` },
      ]);
    } catch (err) {
      console.error("resolveJoinRequest notify failed", err);
    }
    // Announce their arrival in the thread.
    await announceJoin(seedId, targetUserId);
  } else {
    await db.seedJoinRequest.update({
      where: { seedId_userId: { seedId, userId: targetUserId } },
      data: { status: "declined", decidedAt: new Date() },
    });
  }
  return { ok: true };
}
