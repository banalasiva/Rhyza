import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { followUser, unfollowUser } from "@/lib/services/follows";
import { z } from "zod";

const schema = z.object({ following: z.boolean() });

// POST /api/users/:id/follow — follow / unfollow a person. Body: { following }.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const { following } = schema.parse(await req.json());
  return ok(
    following ? await followUser(userId, ctx.params.id) : await unfollowUser(userId, ctx.params.id),
  );
});
