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
