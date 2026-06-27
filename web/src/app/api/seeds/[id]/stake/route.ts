import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { submitStakeSchema } from "@/lib/validation";
import { getStakeBoard, submitStakeRatings } from "@/lib/services/stake";

// GET /api/seeds/:id/stake — the stake board (participants, profiles, weights).
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await getStakeBoard(userId, ctx.params.id));
});

// POST /api/seeds/:id/stake — save/submit this person's peer allocations.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = submitStakeSchema.parse(await req.json());
  return ok(
    await submitStakeRatings(userId, ctx.params.id, body.ratings, body.submit),
  );
});
