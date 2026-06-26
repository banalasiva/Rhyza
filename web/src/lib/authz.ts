import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";

// Resolve the signed-in user id, or throw 401. Use in API routes.
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new ApiError("UNAUTHORIZED", "Sign in required");
  return session.user.id;
}

// Like requireUserId but returns null instead of throwing — for pages.
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

// Throw 403 unless the user belongs to the org.
export async function requireOrgMember(userId: string, orgId: string) {
  const m = await db.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!m) throw new ApiError("FORBIDDEN", "Not a member of this organization");
  return m;
}

// Throw 403 unless the user can access the garden. Garden access is granted to
// any member of the garden's org (org-wide visibility), and elevated actions
// check garden membership/role separately.
export async function requireGardenAccess(userId: string, gardenId: string) {
  const garden = await db.garden.findUnique({ where: { id: gardenId } });
  if (!garden) throw new ApiError("NOT_FOUND", "Garden not found");
  await requireOrgMember(userId, garden.orgId);
  return garden;
}

// Ensure the user is a garden member; auto-join org members on first interaction
// so contributing to an org garden doesn't require a separate join step.
export async function ensureGardenMember(userId: string, gardenId: string) {
  const garden = await requireGardenAccess(userId, gardenId);
  await db.gardenMember.upsert({
    where: { gardenId_userId: { gardenId, userId } },
    update: {},
    create: { gardenId, userId },
  });
  return garden;
}

// Throw 403 unless the user is a steward of the garden (or its creator).
// Stewards can edit/delete the garden and moderate contributions.
export async function requireGardenSteward(userId: string, gardenId: string) {
  const garden = await db.garden.findUnique({ where: { id: gardenId } });
  if (!garden) throw new ApiError("NOT_FOUND", "Garden not found");
  if (garden.createdById === userId) return garden;
  const member = await db.gardenMember.findUnique({
    where: { gardenId_userId: { gardenId, userId } },
  });
  if (member?.role !== "steward") {
    throw new ApiError("FORBIDDEN", "Only a garden steward can do that");
  }
  return garden;
}

// The user's primary org (first joined). v1 assumes one org per user for the
// happy path; the schema supports many.
export async function primaryOrgId(userId: string): Promise<string | null> {
  const m = await db.orgMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  });
  return m?.orgId ?? null;
}
