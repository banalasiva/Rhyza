import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { listMyNetwork } from "@/lib/services/members";

// GET /api/me/network — people the viewer shares a garden with, for invite
// autocomplete. Only surfaces collaborators the viewer can already see.
export const GET = handle(async () => {
  const userId = await requireUserId();
  return ok({ people: await listMyNetwork(userId) });
});
