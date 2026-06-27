import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getBloomDetail, updateBloom } from "@/lib/services/blooms";
import { updateBloomSchema } from "@/lib/validation";

// GET /api/blooms/:id — bloom detail + contributors + version history.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await getBloomDetail(userId, ctx.params.id));
});

// PATCH /api/blooms/:id — edit the (AI-synthesized) title/summary.
export const PATCH = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = updateBloomSchema.parse(await req.json());
  return ok(await updateBloom(userId, ctx.params.id, body));
});
