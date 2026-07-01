import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { listPendingInvites } from "@/lib/services/invites";

// GET /api/invites/pending — the people you invited who haven't joined yet,
// for the "Waiting for them" nudge surface.
export const GET = handle(async () => {
  const userId = await requireUserId();
  return ok({ invites: await listPendingInvites(userId) });
});
