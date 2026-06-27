import { db } from "@/lib/db";
import { uniqueSlug } from "@/lib/slug";

// Create an organization and make the creator its owner. Every user lands here
// on first sign-in (no org yet) so there's no hardcoded/default org anywhere.
export async function createOrgForUser(userId: string, name: string) {
  const org = await db.organization.create({
    data: {
      name,
      slug: uniqueSlug(name),
      members: { create: { userId, role: "owner" } },
    },
  });
  return org;
}

// Auto-join any org whose configured email domain matches the user's email.
// Lets enterprise SSO users land directly in their org without an invite.
export async function autoJoinByDomain(userId: string, email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  const org = await db.organization.findFirst({ where: { ssoDomain: domain } });
  if (!org) return null;
  await db.orgMember.upsert({
    where: { orgId_userId: { orgId: org.id, userId } },
    update: {},
    create: { orgId: org.id, userId, role: "member" },
  });
  return org;
}

// Consumer email providers — these don't represent a shared organization, so
// each such user gets their own personal workspace instead of being lumped
// together by domain.
const CONSUMER_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com",
  "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com", "mac.com",
  "aol.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "zoho.com",
  "mail.com", "fastmail.com", "hey.com",
]);

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Make sure a freshly signed-in user belongs to an org, with ZERO prompts:
//   1. A company domain that already has a workspace → join it.
//   2. A new company domain → create the company workspace (and remember the
//      domain) so colleagues auto-join later.
//   3. A consumer email → a private personal workspace.
// Returns the org id. Idempotent: a no-op if the user already has an org.
export async function ensureUserOrg(
  userId: string,
  email: string,
  name: string,
): Promise<string> {
  const existing = await db.orgMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: { orgId: true },
  });
  if (existing) return existing.orgId;

  const joined = await autoJoinByDomain(userId, email);
  if (joined) return joined.id;

  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const isCompany = domain && !CONSUMER_DOMAINS.has(domain);

  if (isCompany) {
    const label = titleCase(domain.split(".")[0] || domain);
    const org = await db.organization.create({
      data: {
        name: label,
        slug: uniqueSlug(label),
        ssoDomain: domain, // colleagues auto-join from here on
        members: { create: { userId, role: "owner" } },
      },
    });
    return org.id;
  }

  // Personal workspace for consumer emails.
  const who = name?.trim() || email.split("@")[0] || "My";
  const org = await db.organization.create({
    data: {
      name: `${who}'s Workspace`,
      slug: uniqueSlug(who),
      members: { create: { userId, role: "owner" } },
    },
  });
  return org.id;
}
