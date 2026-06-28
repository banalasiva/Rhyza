import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { pollVoteSchema } from "@/lib/validation";
import { votePoll } from "@/lib/services/polls";

// POST /api/polls/:id/vote — cast/change my vote.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = pollVoteSchema.parse(await req.json());
  return ok(await votePoll(userId, ctx.params.id, body.optionId));
});
