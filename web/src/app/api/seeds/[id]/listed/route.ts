import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { listedSchema } from "@/lib/validation";
import { setSeedListed } from "@/lib/services/explore";

// POST /api/seeds/:id/listed — owner publishes the seed to the world (Explore)
// or pulls it back. Body: { listed }.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const { listed } = listedSchema.parse(await req.json());
  return ok(await setSeedListed(userId, ctx.params.id, listed));
});
