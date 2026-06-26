import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { stageVoteSchema } from "@/lib/validation";
import { castStageVote } from "@/lib/services/voting";

// POST /api/seeds/:id/stage-votes — cast/update a stage vote. May trigger a bloom.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = stageVoteSchema.parse(await req.json());
  return ok(await castStageVote(userId, ctx.params.id, body.stage));
});
