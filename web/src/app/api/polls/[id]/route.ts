import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { setPollClosed, deletePoll } from "@/lib/services/polls";

// PATCH /api/polls/:id — close/reopen (author only). Body: { closed: boolean }.
export const PATCH = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = (await req.json().catch(() => ({}))) as { closed?: boolean };
  return ok(await setPollClosed(userId, ctx.params.id, !!body.closed));
});

// DELETE /api/polls/:id — remove a poll (author only).
export const DELETE = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await deletePoll(userId, ctx.params.id));
});
