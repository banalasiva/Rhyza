import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { listAddablePeople } from "@/lib/services/members";
import { enforceRateLimit } from "@/lib/ratelimit";

// GET /api/seeds/:id/addable?q=… — people on ThinkThru you can add to the seed.
// Rate-limited per user: the query searches all people, so an unthrottled caller
// could otherwise walk the directory. Names only (no emails — see members.ts).
export const GET = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  await enforceRateLimit(`addable:${userId}`, 40, 60); // 40 searches / minute
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  return ok({ people: await listAddablePeople(userId, ctx.params.id, q) });
});
