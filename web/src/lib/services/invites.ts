import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import {
  ensureGardenMember,
  requireSeedAccess,
  requireSeedManager,
  requireGardenSteward,
} from "@/lib/authz";
import { appUrl, sendEmail, inviteEmailHtml, emailConfigured } from "@/lib/email";

const INVITE_TTL_DAYS = 30;

function inviteLink(token: string) {
  return `${appUrl()}/invite/${token}`;
}

// People you invited who still haven't joined — the raw material for the
// "Waiting for them" nudge. Only your own pending, unexpired invites, newest
// first, with the seed/garden they were invited into and a ready-to-send link.
export async function listPendingInvites(userId: string) {
  const invites = await db.invite.findMany({
    where: {
      invitedById: userId,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" }, // newest first, so dedupe keeps the freshest
    take: 200,
    include: {
      seed: { select: { id: true, title: true } },
      garden: { select: { name: true } },
    },
  });

  // Someone can have several pending invites to the same place (each Copy/Share
  // makes a fresh link), and can join through one while the others stay
  // "pending". So: (1) hide anyone whose invited email is already a member of
  // that invite's org, and (2) collapse duplicates to one row per person.
  const emails = [...new Set(invites.map((i) => i.email?.toLowerCase()).filter(Boolean))] as string[];
  const joined = new Set<string>(); // "orgId:email" for people already in
  if (emails.length) {
    const users = await db.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });
    if (users.length) {
      const orgIds = [...new Set(invites.map((i) => i.orgId))];
      const members = await db.orgMember.findMany({
        where: { userId: { in: users.map((u) => u.id) }, orgId: { in: orgIds } },
        select: { userId: true, orgId: true },
      });
      const emailById = new Map(users.map((u) => [u.id, u.email.toLowerCase()]));
      for (const m of members) {
        const e = emailById.get(m.userId);
        if (e) joined.add(`${m.orgId}:${e}`);
      }
    }
  }

  const seen = new Set<string>();
  const out: {
    id: string;
    email: string | null;
    place: string | null;
    seedId: string | null;
    link: string;
    invitedAt: string;
  }[] = [];
  for (const i of invites) {
    const email = i.email?.toLowerCase() ?? null;
    if (email && joined.has(`${i.orgId}:${email}`)) continue; // already joined
    // One row per person: by email, or by scope for anonymous link invites.
    const key = email ?? `link:${i.seedId ?? i.gardenId ?? i.orgId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: i.id,
      email: i.email,
      place: i.seed?.title ?? i.garden?.name ?? null,
      seedId: i.seedId,
      link: inviteLink(i.token),
      invitedAt: i.createdAt.toISOString(),
    });
  }
  return out;
}

// Create an invite to a garden (which also grants org membership on accept),
// optionally scoped to a specific email, and email it if Resend is configured.
export async function createGardenInvite(
  userId: string,
  gardenId: string,
  email: string | undefined,
) {
  const garden = await ensureGardenMember(userId, gardenId);
  // A private garden's roster is the access boundary — only a steward may widen
  // it. Public gardens are open to org members, so any member may invite.
  if (garden.visibility === "private") {
    await requireGardenSteward(userId, gardenId);
  }
  const inviter = await db.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  // Reuse an existing pending invite for the same garden + person instead of
  // piling up duplicate rows every time you re-share the link.
  const normEmail = email?.toLowerCase() || null;
  const existing = await db.invite.findFirst({
    where: {
      invitedById: userId,
      gardenId: garden.id,
      seedId: null,
      email: normEmail,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
  const token = existing?.token ?? randomBytes(24).toString("base64url");
  if (!existing) {
    await db.invite.create({
      data: {
        orgId: garden.orgId,
        gardenId: garden.id,
        email: normEmail,
        token,
        invitedById: userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });
  }

  const org = await db.organization.findUnique({
    where: { id: garden.orgId },
    select: { name: true },
  });

  const link = inviteLink(token);
  let emailed = false;
  if (email && emailConfigured()) {
    emailed = await sendEmail({
      to: email,
      subject: `You're invited to ${garden.name} on ThinkThru`,
      html: inviteEmailHtml({
        orgName: org?.name ?? "an organization",
        gardenName: garden.name,
        inviterName: inviter?.name || "A teammate",
        link,
      }),
    });
  }

  return { token, link, emailed };
}

// Create an invite to a specific seed (used for private seeds). Accepting joins
// the org, the garden, and the seed. For a PRIVATE seed only a manager
// (owner/steward) may invite — the member roster is the access boundary, so a
// regular member can't pull outsiders into a private discussion. Public seeds
// are open to garden members, so any participant may invite.
export async function createSeedInvite(
  userId: string,
  seedId: string,
  email: string | undefined,
) {
  const seed = await requireSeedAccess(userId, seedId);
  if (seed.visibility === "private") {
    await requireSeedManager(userId, seedId);
  }
  const [garden, inviter] = await Promise.all([
    db.garden.findUnique({ where: { id: seed.gardenId }, select: { name: true, orgId: true } }),
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  if (!garden) throw new ApiError("NOT_FOUND", "Garden not found");
  const orgRow = await db.organization.findUnique({
    where: { id: garden.orgId },
    select: { name: true },
  });

  // Reuse an existing pending invite for the same seed + person instead of
  // creating a duplicate row on every re-share.
  const normEmail = email?.toLowerCase() || null;
  const existing = await db.invite.findFirst({
    where: {
      invitedById: userId,
      seedId: seed.id,
      email: normEmail,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
  const token = existing?.token ?? randomBytes(24).toString("base64url");
  if (!existing) {
    await db.invite.create({
      data: {
        orgId: garden.orgId,
        gardenId: seed.gardenId,
        seedId: seed.id,
        email: normEmail,
        token,
        invitedById: userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });
  }

  const link = inviteLink(token);
  let emailed = false;
  if (email && emailConfigured()) {
    emailed = await sendEmail({
      to: email,
      subject: `You're invited to a discussion on ThinkThru`,
      html: inviteEmailHtml({
        orgName: orgRow?.name ?? "an organization",
        gardenName: `${garden.name} · ${seed.title}`,
        inviterName: inviter?.name || "A teammate",
        link,
      }),
    });
  }

  return { token, link, emailed };
}

// Public-ish lookup for the accept page (no auth required to view).
export async function getInviteByToken(token: string) {
  const invite = await db.invite.findUnique({
    where: { token },
    include: {
      org: { select: { name: true } },
      garden: { select: { id: true, name: true, emoji: true } },
      seed: { select: { id: true, title: true, content: true } },
      invitedBy: { select: { name: true } },
    },
  });
  if (!invite) return null;
  const expired = invite.expiresAt.getTime() < Date.now();
  // For a seed invite, surface the actual question so the person sees what
  // they're being pulled into — content is far more magnetic than a name.
  const seed = invite.seed
    ? {
        title: invite.seed.title,
        snippet:
          invite.seed.content.length > 180
            ? `${invite.seed.content.slice(0, 180).trimEnd()}…`
            : invite.seed.content,
      }
    : null;
  // Note: the invite's scoped `email` is intentionally NOT returned here — the
  // accept page is unauthenticated, so we don't expose the target address to
  // anyone holding the link. acceptInvite() checks the email match server-side.
  return {
    token: invite.token,
    status: invite.status,
    expired,
    orgName: invite.org.name,
    garden: invite.garden,
    seed,
    inviterName: invite.invitedBy.name,
  };
}

// Accept an invite: join the org (and garden, if scoped). Validates state,
// expiry, and — if the invite is email-scoped — that the emails match.
export async function acceptInvite(userId: string, userEmail: string, token: string) {
  const invite = await db.invite.findUnique({ where: { token } });
  if (!invite) throw new ApiError("NOT_FOUND", "Invite not found");
  // Invites are reusable links — many people can join from one shared link, and
  // re-clicking is harmless (memberships upsert below). Only a turned-off
  // (revoked) or expired link is refused.
  if (invite.status === "revoked") throw new ApiError("CONFLICT", "This invite was turned off.");
  if (invite.expiresAt.getTime() < Date.now()) throw new ApiError("CONFLICT", "This invite link has expired.");
  if (invite.email && invite.email !== userEmail.toLowerCase()) {
    throw new ApiError("FORBIDDEN", `This invite is for ${invite.email}`);
  }

  await db.$transaction(async (tx) => {
    await tx.orgMember.upsert({
      where: { orgId_userId: { orgId: invite.orgId, userId } },
      update: {},
      create: { orgId: invite.orgId, userId, role: invite.role },
    });
    if (invite.gardenId) {
      await tx.gardenMember.upsert({
        where: { gardenId_userId: { gardenId: invite.gardenId, userId } },
        update: {},
        create: { gardenId: invite.gardenId, userId },
      });
    }
    if (invite.seedId) {
      await tx.seedMember.upsert({
        where: { seedId_userId: { seedId: invite.seedId, userId } },
        update: {},
        create: { seedId: invite.seedId, userId },
      });
    }
    await tx.invite.update({
      where: { token },
      data: { status: "accepted", acceptedAt: new Date(), acceptedById: userId },
    });
  });

  return { gardenId: invite.gardenId, seedId: invite.seedId, orgId: invite.orgId };
}

// If the signed-in viewer already has access to what this invite points to,
// return where to send them (the seed, or the garden) — so re-opening an invite
// they've already accepted just takes them in, never shows an "expired" wall.
export async function inviteMemberDestination(
  userId: string,
  token: string,
): Promise<string | null> {
  const invite = await db.invite.findUnique({
    where: { token },
    select: { seedId: true, gardenId: true },
  });
  if (!invite) return null;
  // Seed invite: only send them in once they're actually a member of the seed
  // (so a private seed never lands them on an access-denied page). Otherwise let
  // them accept it.
  if (invite.seedId) {
    const sm = await db.seedMember
      .findUnique({
        where: { seedId_userId: { seedId: invite.seedId, userId } },
        select: { userId: true },
      })
      .catch(() => null);
    return sm ? `/seeds/${invite.seedId}` : null;
  }
  if (invite.gardenId) {
    const gm = await db.gardenMember
      .findUnique({
        where: { gardenId_userId: { gardenId: invite.gardenId, userId } },
        select: { userId: true },
      })
      .catch(() => null);
    if (gm) return `/gardens/${invite.gardenId}`;
  }
  return null;
}
