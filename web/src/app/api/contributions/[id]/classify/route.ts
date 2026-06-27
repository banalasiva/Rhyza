import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { classifyContribution } from "@/lib/services/contributions";

// POST /api/contributions/:id/classify — let Claude label the message's
// dimension (called right after posting so the badge fills in).
export const POST = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await classifyContribution(userId, ctx.params.id));
});
