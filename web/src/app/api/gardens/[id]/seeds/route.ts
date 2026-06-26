import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { createSeedSchema } from "@/lib/validation";
import { plantSeed } from "@/lib/services/seeds";

// POST /api/gardens/:id/seeds — plant a seed.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = createSeedSchema.parse(await req.json());
  const seed = await plantSeed(userId, ctx.params.id, body);
  return ok({ id: seed.id, title: seed.title }, 201);
});
