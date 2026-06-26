import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { toggleEndorsement } from "@/lib/services/contributions";

// POST /api/contributions/:id/endorsements — toggle an endorsement.
export const POST = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await toggleEndorsement(userId, ctx.params.id));
});
