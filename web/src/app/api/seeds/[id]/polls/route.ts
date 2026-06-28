import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { createPollSchema } from "@/lib/validation";
import { createPoll, listPolls } from "@/lib/services/polls";

// GET /api/seeds/:id/polls — all polls in the seed with results.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await listPolls(userId, ctx.params.id));
});

// POST /api/seeds/:id/polls — create a poll.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = createPollSchema.parse(await req.json());
  await createPoll(userId, ctx.params.id, body);
  return ok(await listPolls(userId, ctx.params.id));
});
