import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireSeedAccess, requireSeedManager } from "@/lib/authz";
import { deliver } from "@/lib/services/notify";
import { connectedUserIds } from "@/lib/services/connections";

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
  // Your circle = everyone you've collaborated with (co-members of any garden OR
  // seed you're in) PLUS everyone you've accepted a connection with — so the
  // "add existing" picker shows your whole family/group, including people you met
  // through a connection rather than a shared garden.
  const [myGardens, mySeeds, connectedIds] = await Promise.all([
    db.gardenMember.findMany({ where: { userId }, select: { gardenId: true } }),
    db.seedMember.findMany({ where: { userId }, select: { seedId: true } }),
    connectedUserIds(userId),
  ]);
  const gardenIds = myGardens.map((g: { gardenId: string }) => g.gardenId);
  const seedIds = mySeeds.map((s: { seedId: string }) => s.seedId);
  if (gardenIds.length === 0 && seedIds.length === 0 && connectedIds.length === 0) return [];

  const userSel = { user: { select: { id: true, name: true, email: true, image: true } } };
  const [gardenPeople, seedPeople, connectedPeople] = await Promise.all([
    gardenIds.length
      ? db.gardenMember.findMany({
          where: { gardenId: { in: gardenIds }, userId: { not: userId } },
          select: userSel,
          take: 1000,
        })
      : Promise.resolve([]),
    seedIds.length
      ? db.seedMember.findMany({
          where: { seedId: { in: seedIds }, userId: { not: userId } },
          select: userSel,
          take: 1000,
        })
      : Promise.resolve([]),
    connectedIds.length
      ? db.user.findMany({
          where: { id: { in: connectedIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : Promise.resolve([]),
  ]);

  const seen = new Map<string, NetworkPerson>();
  const addUser = (u: { id: string; name: string | null; email: string | null; image: string | null }) => {
    if (u?.id && u.email && !seen.has(u.id)) {
      seen.set(u.id, { id: u.id, name: u.name || u.email, email: u.email, image: u.image });
    }
  };
  for (const m of [...gardenPeople, ...seedPeople] as {
    user: { id: string; name: string | null; email: string | null; image: string | null };
  }[]) {
    addUser(m.user);
  }
  for (const u of connectedPeople as {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  }[]) {
    addUser(u);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Who can add people to a seed: the same rule as inviting — anyone with access
// Any member with access to the seed (public or private) can add existing
// people — so anyone in the group can bring others in. (Removing/promoting is
// still manager-only, elsewhere.)
async function assertCanAdd(actorId: string, seedId: string) {
  return await requireSeedAccess(actorId, seedId);
}

// People YOU can drop straight into the seed — drawn from your own contacts
// (anyone you already share a garden or seed with), NOT the whole org directory.
// This is deliberate: your parents shouldn't see your company's colleagues just
// because you both signed in — you only see and add people you've actually
// connected with. Excludes anyone already in the seed, the AI users, and
// yourself. Optional `q` filters by name/email.
export async function listAddablePeople(actorId: string, seedId: string, q?: string) {
  const seed = await assertCanAdd(actorId, seedId);

  const [network, seedMembers, contributors] = await Promise.all([
    listMyNetwork(actorId),
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

  // Before the person searches, show only a few suggestions — a big group should
  // never render as a wall of names. Once they type, surface up to 20 matches.
  const cap = needle ? 20 : 6;

  return network
    .filter((p) => !exclude.has(p.id) && p.name !== "Claude" && p.name !== "ChatGPT")
    .filter(
      (p) =>
        !needle || p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle),
    )
    .slice(0, cap);
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

  // Privacy: you can only directly add people you've already connected with
  // (share a garden or seed) — not any stranger in the org. Anyone else needs an
  // invite. This is what keeps your parents from seeing your colleagues.
  const network = await listMyNetwork(actorId);
  if (!network.some((p) => p.id === targetId)) {
    throw new ApiError("BAD_REQUEST", "They're not in your circle yet — send them an invite instead.");
  }
  // Access: they must belong to this garden's org, or garden access would reject
  // them after we add them. In the normal single-org case a contact always is;
  // this guards the cross-org edge — send an invite instead there.
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
