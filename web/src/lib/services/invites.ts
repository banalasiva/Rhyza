import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { ensureGardenMember } from "@/lib/authz";
import { appUrl, sendEmail, inviteEmailHtml, emailConfigured } from "@/lib/email";

const INVITE_TTL_DAYS = 14;

function inviteLink(token: string) {
  return `${appUrl()}/invite/${token}`;
}

// Create an invite to a garden (which also grants org membership on accept),
// optionally scoped to a specific email, and email it if Resend is configured.
export async function createGardenInvite(
  userId: string,
  gardenId: string,
  email: string | undefined,
) {
  const garden = await ensureGardenMember(userId, gardenId);
  const inviter = await db.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.invite.create({
    data: {
      orgId: garden.orgId,
      gardenId: garden.id,
      email: email?.toLowerCase() || null,
      token,
      invitedById: userId,
      expiresAt,
    },
  });

  const org = await db.organization.findUnique({
    where: { id: garden.orgId },
    select: { name: true },
  });

  const link = inviteLink(token);
  let emailed = false;
  if (email && emailConfigured()) {
    emailed = await sendEmail({
      to: email,
      subject: `You're invited to ${garden.name} on Rhyza`,
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

// Public-ish lookup for the accept page (no auth required to view).
export async function getInviteByToken(token: string) {
  const invite = await db.invite.findUnique({
    where: { token },
    include: {
      org: { select: { name: true } },
      garden: { select: { id: true, name: true, emoji: true } },
      invitedBy: { select: { name: true } },
    },
  });
  if (!invite) return null;
  const expired = invite.expiresAt.getTime() < Date.now();
  return {
    token: invite.token,
    status: invite.status,
    expired,
    email: invite.email,
    orgName: invite.org.name,
    garden: invite.garden,
    inviterName: invite.invitedBy.name,
  };
}

// Accept an invite: join the org (and garden, if scoped). Validates state,
// expiry, and — if the invite is email-scoped — that the emails match.
export async function acceptInvite(userId: string, userEmail: string, token: string) {
  const invite = await db.invite.findUnique({ where: { token } });
  if (!invite) throw new ApiError("NOT_FOUND", "Invite not found");
  if (invite.status !== "pending") throw new ApiError("CONFLICT", "This invite has already been used");
  if (invite.expiresAt.getTime() < Date.now()) throw new ApiError("CONFLICT", "This invite has expired");
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
    await tx.invite.update({
      where: { token },
      data: { status: "accepted", acceptedAt: new Date(), acceptedById: userId },
    });
  });

  return { gardenId: invite.gardenId, orgId: invite.orgId };
}
