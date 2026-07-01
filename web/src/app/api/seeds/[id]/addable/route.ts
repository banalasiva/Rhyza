import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { listAddablePeople } from "@/lib/services/members";

// GET /api/seeds/:id/addable?q=… — people already on ThinkThru (in this seed's
// org) you can add straight to the seed, no invite link needed.
export const GET = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  return ok({ people: await listAddablePeople(userId, ctx.params.id, q) });
});
