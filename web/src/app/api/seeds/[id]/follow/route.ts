import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { followSchema } from "@/lib/validation";
import { followSeed } from "@/lib/services/explore";

// POST /api/seeds/:id/follow — follow / unfollow a seed. Body: { following }.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const { following } = followSchema.parse(await req.json());
  return ok(await followSeed(userId, ctx.params.id, following));
});
