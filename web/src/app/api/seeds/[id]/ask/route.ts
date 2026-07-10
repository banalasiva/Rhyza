import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { askOnSeed } from "@/lib/services/asks";
import { listMyNetwork } from "@/lib/services/members";

export const dynamic = "force-dynamic";

// GET /api/seeds/:id/ask — the people you can ask (your circle), for the picker.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const people = await listMyNetwork(userId);
  return ok({ people });
});

const AskBody = z.object({ userIds: z.array(z.string().uuid()).min(1).max(20) });

// POST /api/seeds/:id/ask { userIds } — ask specific people to weigh in.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const { userIds } = AskBody.parse(await req.json());
  return ok(await askOnSeed(userId, ctx.params.id, userIds));
});
