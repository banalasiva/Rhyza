import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getSeedDetail, setSeedVisibility } from "@/lib/services/seeds";
import { setSeedVisibilitySchema } from "@/lib/validation";

// GET /api/seeds/:id — seed detail + stage distribution + contributions.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await getSeedDetail(userId, ctx.params.id));
});

// PATCH /api/seeds/:id — change seed visibility (creator / seed steward).
export const PATCH = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = setSeedVisibilitySchema.parse(await req.json());
  return ok(await setSeedVisibility(userId, ctx.params.id, body.visibility));
});
