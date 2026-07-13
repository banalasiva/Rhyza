import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { dismissAddNotice } from "@/lib/services/members";

// DELETE /api/seeds/:id/notice — dismiss the "added by someone outside your
// circle" heads-up ("I'm happy to be here"). Clears it server-side so it never
// shows again on any device.
export const DELETE = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await dismissAddNotice(userId, ctx.params.id));
});
