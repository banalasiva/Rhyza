import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { listJoinRequests, resolveJoinRequest } from "@/lib/services/joinreq";

export const dynamic = "force-dynamic";

// GET /api/seeds/:id/join-requests — the pending knocks (owner/stewards only).
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok({ people: await listJoinRequests(userId, ctx.params.id) });
});

const Body = z.object({ targetId: z.string().uuid(), approve: z.boolean() });

// POST /api/seeds/:id/join-requests { targetId, approve } — let someone in or
// decline (owner/stewards only).
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const { targetId, approve } = Body.parse(await req.json());
  return ok(await resolveJoinRequest(userId, ctx.params.id, targetId, approve));
});
