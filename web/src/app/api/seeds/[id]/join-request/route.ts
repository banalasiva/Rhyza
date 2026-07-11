import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { requestToJoin } from "@/lib/services/joinreq";

export const dynamic = "force-dynamic";

// POST /api/seeds/:id/join-request — knock on a private seed. Records a pending
// request and pings the owner/stewards to approve.
export const POST = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await requestToJoin(userId, ctx.params.id));
});
