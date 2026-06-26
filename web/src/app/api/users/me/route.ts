import { handle, ok } from "@/lib/api";
import { requireUserId, primaryOrgId } from "@/lib/authz";
import { db } from "@/lib/db";

// GET /api/users/me — current user + org membership (drives onboarding redirects).
export const GET = handle(async () => {
  const userId = await requireUserId();
  const [user, orgId] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatarUrl: true, bio: true },
    }),
    primaryOrgId(userId),
  ]);
  return ok({ user, orgId, onboarded: !!orgId });
});
