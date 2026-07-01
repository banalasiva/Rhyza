import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireSeedAccess, requireSeedManager } from "@/lib/authz";
import { deliver } from "@/lib/services/notify";

export type SeedRole = "owner" | "admin" | "member" | "contributor";

export type SeedPerson = {
  id: string;
  name: string;
  image: string | null;
  role: SeedRole;
  isYou: boolean;
};

const ROLE_RANK: Record<SeedRole, number> = { owner: 3, admin: 2, member: 1, contributor: 0 };

// AI participants are authors but aren't people to promote/remove.
const AI_NAMES = new Set(["Claude", "ChatGPT"]);

type SeedRow = {
  id: string;
  gardenId: string;
  createdById: string;
  visibility: string;
};

// Can this user manage the seed (owner, a seed admin/steward, or — for a public
// seed — a garden steward)? Boolean form of requireSeedManager for the roster.
async function canManageSeed(userId: string, seed: SeedRow): Promise<boolean> {
  if (seed.createdById === userId) return true;
  if (seed.visibility === "private") {
    const m = await db.seedMember.findUnique({
      where: { seedId_userId: { seedId: seed.id, userId } },
    });
    return m?.role === "steward";
  }
  const gm = await db.gardenMember.findUnique({
    where: { gardenId_userId: { gardenId: seed.gardenId, userId } },
  });
  return gm?.role === "steward";
}

// Everyone involved in a seed with their role, plus whether the viewer can
// manage and whether the seed is private (private = removing/leaving gates real
// access; public access comes from the garden, so the roster is informational).
export async function listSeedPeople(userId: string, seedId: string) {
  const seed = (await requireSeedAccess(userId, seedId)) as SeedRow;

  const [creator, members, contribs, canManage] = await Promise.all([
    db.user.findUnique({
      where: { id: seed.createdById },
      select: { id: true, name: true, image: true },
    }),
    db.seedMember.findMany({
      where: { seedId },
      include: { user: { select: { id: true, name: true, image: true } } },
    }),
    db.contribution.findMany({
      where: { seedId, deletedAt: null },
      select: { author: { select: { id: true, name: true, image: true } } },
      distinct: ["authorId"],
    }),
    canManageSeed(userId, seed),
  ]);

  const byId = new Map<string, SeedPerson>();
  const add = (
    u: { id: string; name: string | null; image: string | null } | null,
    role: SeedRole,
  ) => {
    if (!u) return;
    if (AI_NAMES.has(u.name ?? "")) return; // skip Claude / ChatGPT
    const prev = byId.get(u.id);
    if (prev && ROLE_RANK[prev.role] >= ROLE_RANK[role]) return; // keep highest role
    byId.set(u.id, {
      id: u.id,
      name: u.name || "Someone",
      image: u.image,
      role,
      isYou: u.id === userId,
    });
  };

  add(creator, "owner");
  for (const m of members) add(m.user, m.role === "steward" ? "admin" : "member");
  for (const c of contribs) add(c.author, "contributor");

  const people = [...byId.values()].sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role]);
  return { people, canManage, isPrivate: seed.visibility === "private", ownerId: seed.createdById };
}

// Promote/demote a participant to/from admin (seed steward). Manager-only; the
// owner's role can't be changed. Creates a membership row if needed so a public
// seed's contributor can be made an admin.
export async function setSeedAdmin(
  actorId: string,
  seedId: string,
  targetId: string,
  makeAdmin: boolean,
) {
  const seed = await requireSeedManager(actorId, seedId);
  if (targetId === seed.createdById) {
    throw new ApiError("BAD_REQUEST", "The owner's role can't be changed.");
  }
  // You can only set the role of someone who is already a participant — this
  // stops "make admin" being used to inject an arbitrary user into a private
  // seed (granting access). They must already be a member or have contributed.
  const [contributed, existing] = await Promise.all([
    db.contribution.findFirst({
      where: { seedId, authorId: targetId, deletedAt: null },
      select: { id: true },
    }),
    db.seedMember.findUnique({
      where: { seedId_userId: { seedId, userId: targetId } },
      select: { userId: true },
    }),
  ]);
  if (!contributed && !existing) {
    throw new ApiError("BAD_REQUEST", "That person isn't part of this seed yet.");
  }
  const role = makeAdmin ? "steward" : "member";
  await db.seedMember.upsert({
    where: { seedId_userId: { seedId, userId: targetId } },
    update: { role },
    create: { seedId, userId: targetId, role },
  });
  return { ok: true };
}

// Remove a participant from the seed. Manager-only; never the owner, and not
// yourself (use leaveSeed). On a private seed this revokes access.
export async function removeSeedMember(actorId: string, seedId: string, targetId: string) {
  const seed = await requireSeedManager(actorId, seedId);
  if (targetId === seed.createdById) {
    throw new ApiError("BAD_REQUEST", "You can't remove the owner.");
  }
  if (targetId === actorId) {
    throw new ApiError("BAD_REQUEST", "Use “Leave seed” to remove yourself.");
  }
  await db.seedMember.deleteMany({ where: { seedId, userId: targetId } });
  return { ok: true };
}

// Leave a seed yourself. The owner can't leave (they'd delete the seed instead).
export async function leaveSeed(userId: string, seedId: string) {
  const seed = await requireSeedAccess(userId, seedId);
  if (seed.createdById === userId) {
    throw new ApiError("BAD_REQUEST", "You created this seed — delete it instead of leaving.");
  }
  await db.seedMember.deleteMany({ where: { seedId, userId } });
  return { ok: true };
}

export type NetworkPerson = { id: string; name: string; email: string; image: string | null };

// People the viewer has already collaborated with — anyone who shares a garden
// with them. Powers invite autocomplete: you mostly re-invite the same circle,
// and re-inviting them into new gardens is the network-effect flywheel.
export async function listMyNetwork(userId: string): Promise<NetworkPerson[]> {
  const myGardens = await db.gardenMember.findMany({
    where: { userId },
    select: { gardenId: true },
  });
  const gardenIds = myGardens.map((g: { gardenId: string }) => g.gardenId);
  if (gardenIds.length === 0) return [];

  const members = await db.gardenMember.findMany({
    where: { gardenId: { in: gardenIds }, userId: { not: userId } },
    select: { user: { select: { id: true, name: true, email: true, image: true } } },
    take: 1000,
  });

  const seen = new Map<string, NetworkPerson>();
  for (const m of members as { user: { id: string; name: string | null; email: string | null; image: string | null } }[]) {
    const u = m.user;
    if (u?.email && !seen.has(u.id)) {
      seen.set(u.id, { id: u.id, name: u.name || u.email, email: u.email, image: u.image });
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Who can add people to a seed: the same rule as inviting — anyone with access
// to a public seed, only a manager for a private one.
async function assertCanAdd(actorId: string, seedId: string) {
  const seed = await requireSeedAccess(actorId, seedId);
  if (seed.visibility === "private") await requireSeedManager(actorId, seedId);
  return seed;
}

// People already on ThinkThru (in this seed's org) you can drop straight into
// the seed — no invite link needed. Excludes anyone already in the seed, the
// AI users, and yourself. Optional `q` filters by name/email.
export async function listAddablePeople(actorId: string, seedId: string, q?: string) {
  const seed = await assertCanAdd(actorId, seedId);
  const garden = await db.garden.findUnique({
    where: { id: seed.gardenId },
    select: { orgId: true },
  });
  if (!garden) return [];

  const [orgMembers, seedMembers, contributors] = await Promise.all([
    db.orgMember.findMany({
      where: { orgId: garden.orgId },
      select: { user: { select: { id: true, name: true, email: true, image: true } } },
      take: 1000,
    }),
    db.seedMember.findMany({ where: { seedId }, select: { userId: true } }),
    db.contribution.findMany({
      where: { seedId, deletedAt: null },
      distinct: ["authorId"],
      select: { authorId: true },
    }),
  ]);

  const exclude = new Set<string>([
    actorId,
    seed.createdById,
    ...(seedMembers as { userId: string }[]).map((m) => m.userId),
    ...(contributors as { authorId: string }[]).map((c) => c.authorId),
  ]);
  const needle = (q ?? "").trim().toLowerCase();

  return (orgMembers as { user: { id: string; name: string | null; email: string | null; image: string | null } }[])
    .map((m) => m.user)
    .filter((u) => u && u.email && !exclude.has(u.id) && u.name !== "Claude" && u.name !== "ChatGPT")
    .filter(
      (u) =>
        !needle ||
        (u.name ?? "").toLowerCase().includes(needle) ||
        (u.email ?? "").toLowerCase().includes(needle),
    )
    .slice(0, 20)
    .map((u) => ({ id: u.id, name: u.name || (u.email as string), email: u.email as string, image: u.image }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Add an existing org member straight into the seed (member role) and let them
// know — the "they're already here, no invite" path. They must already belong
// to the seed's org; otherwise send an invite instead.
export async function addExistingMember(actorId: string, seedId: string, targetId: string) {
  const seed = await assertCanAdd(actorId, seedId);
  const garden = await db.garden.findUnique({
    where: { id: seed.gardenId },
    select: { id: true, orgId: true },
  });
  if (!garden) throw new ApiError("NOT_FOUND", "Garden not found");

  const inOrg = await db.orgMember.findUnique({
    where: { orgId_userId: { orgId: garden.orgId, userId: targetId } },
    select: { userId: true },
  });
  if (!inOrg) {
    throw new ApiError("BAD_REQUEST", "They're not in this space yet — send them an invite instead.");
  }

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

  // Tell the person they were added.
  try {
    const [seedRow, actor] = await Promise.all([
      db.seed.findUnique({ where: { id: seedId }, select: { title: true } }),
      db.user.findUnique({ where: { id: actorId }, select: { name: true } }),
    ]);
    const title = `You were added to “${seedRow?.title ?? "a seed"}”`;
    const body = `${actor?.name || "Someone"} added you to think this through together 🌱`;
    const notif = await db.notification.create({
      data: { recipientId: targetId, actorId, type: "member_joined", title, body, entityType: "seed", entityId: seedId },
    });
    await deliver([
      { notificationId: notif.id, recipientId: targetId, type: "member_joined", push: { title, body }, link: `/seeds/${seedId}` },
    ]);
  } catch (err) {
    console.error("addExistingMember notify failed", err);
  }

  return { ok: true };
}
