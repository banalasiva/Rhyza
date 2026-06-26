import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { db } from "@/lib/db";
import { acceptInvite } from "@/lib/services/invites";

// POST /api/invites/:token/accept — join the org/garden the invite points to.
export const POST = handle(async (_req, ctx: { params: { token: string } }) => {
  const userId = await requireUserId();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) throw new ApiError("UNAUTHORIZED", "Sign in required");
  const result = await acceptInvite(userId, user.email, ctx.params.token);
  return ok(result);
});
