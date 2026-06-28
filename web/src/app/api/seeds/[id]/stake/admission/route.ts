import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { admissionVoteSchema } from "@/lib/validation";
import { voteAdmission } from "@/lib/services/stake";

// POST /api/seeds/:id/stake/admission — vote to admit a newcomer to the quorum.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = admissionVoteSchema.parse(await req.json());
  return ok(await voteAdmission(userId, ctx.params.id, body.candidateId, body.approve));
});
