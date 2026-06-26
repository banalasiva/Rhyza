import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { reactionSchema } from "@/lib/validation";
import { toggleReaction } from "@/lib/services/contributions";

// POST /api/contributions/:id/reactions — toggle a reaction.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = reactionSchema.parse(await req.json());
  return ok(await toggleReaction(userId, ctx.params.id, body.reactionKey));
});
