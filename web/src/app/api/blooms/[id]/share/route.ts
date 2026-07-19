import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getOrCreateShareToken } from "@/lib/services/calibration";

// POST /api/blooms/:id/share — mint (or fetch) the calibration share token for a
// bloom, so its decider can invite the people it affected to say how it landed.
export const POST = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const token = await getOrCreateShareToken(userId, ctx.params.id);
  if (!token) throw new ApiError("NOT_FOUND", "Bloom not found");
  return ok({ token });
});
