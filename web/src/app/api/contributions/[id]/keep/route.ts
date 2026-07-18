import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { keepContribution, unkeepContribution, isKept } from "@/lib/services/kept";

// GET    /api/contributions/:id/keep — whether the viewer has kept this message.
// POST   — keep it (personal bookmark).
// DELETE — un-keep it.

export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok({ kept: await isKept(userId, ctx.params.id) });
});

export const POST = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await keepContribution(userId, ctx.params.id));
});

export const DELETE = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await unkeepContribution(userId, ctx.params.id));
});
