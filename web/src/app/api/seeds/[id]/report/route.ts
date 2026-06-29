import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { reportSchema } from "@/lib/validation";
import { reportSeed } from "@/lib/services/explore";

// POST /api/seeds/:id/report — flag the seed (or a contribution in it) for
// moderation. Body: { reason, contributionId? }.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const { reason, contributionId } = reportSchema.parse(await req.json());
  return ok(await reportSeed(userId, ctx.params.id, reason, contributionId));
});
