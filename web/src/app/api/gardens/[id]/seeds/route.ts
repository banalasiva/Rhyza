import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { createSeedSchema } from "@/lib/validation";
import { plantSeed } from "@/lib/services/seeds";
import { kickstartSeed } from "@/lib/services/contributions";

// POST /api/gardens/:id/seeds — plant a seed. Claude opens it with a first
// response (fire-and-forget) so a good question gets an immediate spark.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = createSeedSchema.parse(await req.json());
  const seed = await plantSeed(userId, ctx.params.id, body);
  void kickstartSeed(seed.id);
  return ok({ id: seed.id, title: seed.title }, 201);
});
