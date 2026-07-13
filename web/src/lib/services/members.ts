import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireSeedAccess, requireSeedManager } from "@/lib/authz";
import { deliver } from "@/lib/services/notify";
import { connectedUserIds, getConnectionStatus, type ConnectionStatus } from "@/lib/services/connections";
import { displayName } from "@/lib/display-name";
import { announceJoin } from "@/lib/services/seed-notify";

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
      select: { id: true, name: true, image: true, email: true },
    }),
    db.seedMember.findMany({
      where: { seedId },
      include: { user: { select: { id: true, name: true, image: true, email: true } } },
    }),
    db.contribution.findMany({
      where: { seedId, deletedAt: null },
      select: { author: { select: { id: true, name: true, image: true, email: true } } },
      distinct: ["authorId"],
    }),
    canManageSeed(userId, seed),
  ]);

  const byId = new Map<string, SeedPerson>();
  const add = (
    u: { id: string; name: string | null; image: string | null; email: string | null } | null,
    role: SeedRole,
  ) => {
    if (!u) return;
    if (AI_NAMES.has(u.name ?? "")) return; // skip Claude / ChatGPT
    const prev = byId.get(u.id);
    if (prev && ROLE_RANK[prev.role] >= ROLE_RANK[role]) return; // keep highest role
    byId.set(u.id, {
      id: u.id,
      name: displayName(u),
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
  await db.seedAddNotice.deleteMany({ where: { seedId, userId } }).catch(() => {});
  return { ok: true };
}

// "I'm happy to be here" — clear the one-time stranger-add heads-up so it never
// shows again on any device. Best-effort (a missing table is a no-op); safe to
// call whether or not a notice exists, and requires only seed access.
export async function dismissAddNotice(userId: string, seedId: string) {
  await requireSeedAccess(userId, seedId);
  await db.seedAddNotice.deleteMany({ where: { seedId, userId } }).catch(() => {});
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
      seen.set(u.id, { id: u.id, name: displayName(u), email: u.email, image: u.image });
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

export type SuggestedPerson = {
  id: string;
  name: string;
  image: string | null;
  status: Exclude<ConnectionStatus, "connected" | "self">;
};

// "People you may know" for fast onboarding: everyone the viewer already shares
// a garden or seed with (or was invited alongside) whom they haven't connected
// with yet — so a newcomer can send a wave of connects the moment they land,
// WhatsApp-style, and then add those people straight into seeds. Excludes people
// already connected (nothing to do) and the viewer themselves.
// Hide a person from your "Suggested for you" — because you don't want to see
// them, or you already sent a request and are waiting. Idempotent.
export async function dismissSuggestion(userId: string, dismissedId: string): Promise<void> {
  if (userId === dismissedId) return;
  await db.suggestionDismissal
    .upsert({
      where: { userId_dismissedId: { userId, dismissedId } },
      update: {},
      create: { userId, dismissedId },
    })
    .catch(() => {});
}

export async function suggestedConnections(userId: string, limit = 12): Promise<SuggestedPerson[]> {
  const [network, connectedIds, dismissed] = await Promise.all([
    listMyNetwork(userId),
    connectedUserIds(userId).catch(() => [] as string[]),
    db.suggestionDismissal
      .findMany({ where: { userId }, select: { dismissedId: true } })
      .catch(() => [] as { dismissedId: string }[]),
  ]);
  const connected = new Set(connectedIds);
  const hidden = new Set((dismissed as { dismissedId: string }[]).map((d) => d.dismissedId));
  const notYet = network
    .filter((p) => !connected.has(p.id) && !hidden.has(p.id))
    .slice(0, limit);
  if (notYet.length === 0) return [];
  const withStatus = await Promise.all(
    notYet.map(async (p) => ({
      id: p.id,
      name: p.name,
      image: p.image,
      status: await getConnectionStatus(userId, p.id),
    })),
  );
  return withStatus.filter(
    (p): p is SuggestedPerson => p.status !== "connected" && p.status !== "self",
  );
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

  // No query yet → show a few people from your circle as quick suggestions (a big
  // group should never render as a wall of names).
  if (!needle) {
    return network
      .filter((p) => !exclude.has(p.id) && p.name !== "Claude" && p.name !== "ChatGPT")
      .slice(0, 6);
  }

  // Once they type, search EVERYONE on ThinkThru — discoverability is the point:
  // you can find and add anyone by name or email, not only people already in your
  // circle. Circle matches float to the top so familiar faces come first.
  const found = await searchAllPeople(needle, exclude, 20);
  const circleIds = new Set(network.map((p) => p.id));
  return found.sort((a, b) => Number(circleIds.has(b.id)) - Number(circleIds.has(a.id)));
}

// Search every real person on ThinkThru by name or email (case-insensitive),
// excluding AI accounts, deleted users, and anyone in `exclude`. Powers "add
// anyone to a seed" — the open-discoverability model.
export async function searchAllPeople(
  needle: string,
  exclude: Set<string>,
  cap = 20,
): Promise<{ id: string; name: string; email: string; image: string | null }[]> {
  const term = needle.trim();
  if (!term) return [];
  const rows = await db.user.findMany({
    where: {
      deletedAt: null,
      name: { notIn: ["Claude", "ChatGPT"] },
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true, image: true },
    take: cap + 10, // over-fetch a little so exclusions don't shrink the list
  });
  return rows
    .filter((u) => !exclude.has(u.id))
    // NEVER return raw email for strangers found via open search — that would let
    // any signed-in user scrape the whole user directory's emails. Circle members
    // (the no-query path) still carry email since you already share a space.
    .map((u) => ({ id: u.id, name: displayName(u), email: "", image: u.image }))
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

  // Open discoverability: you can add anyone on ThinkThru straight into a seed by
  // searching their name/email — no invite link, no accept step. We only guard
  // that the target is a real, non-deleted person (AI accounts and ghosts can't
  // be added). Whoever adds someone is bridged into this garden's org for them
  // automatically (every Gmail user gets their own personal org), exactly as
  // accepting an invite would — so they can read and reply immediately.
  const target = await db.user.findFirst({
    where: { id: targetId, deletedAt: null, name: { notIn: ["Claude", "ChatGPT"] } },
    select: { id: true },
  });
  if (!target) {
    throw new ApiError("BAD_REQUEST", "That person can't be added.");
  }
  // Is the adder already in the target's circle? If not, we'll leave a one-time
  // "added by someone outside your circle" heads-up so the target can bow out.
  const network = await listMyNetwork(actorId);
  const stranger = !network.some((p) => p.id === targetId);
  await db.$transaction([
    db.orgMember.upsert({
      where: { orgId_userId: { orgId: garden.orgId, userId: targetId } },
      update: {},
      create: { orgId: garden.orgId, userId: targetId, role: "member" },
    }),
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

  // Best-effort, in its OWN table so it can never make the core seed reads fail
  // on an un-migrated DB (the lockout this replaces). A stranger-add records the
  // notice; a circle-add clears any stale one so re-adding a friend is silent.
  if (stranger) {
    await db.seedAddNotice
      .upsert({
        where: { seedId_userId: { seedId, userId: targetId } },
        update: { addedById: actorId },
        create: { seedId, userId: targetId, addedById: actorId },
      })
      .catch(() => {});
  } else {
    await db.seedAddNotice
      .deleteMany({ where: { seedId, userId: targetId } })
      .catch(() => {});
  }

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

  // Show "they joined" in the thread and count them as a member right away.
  await announceJoin(seedId, targetId);

  return { ok: true };
}
