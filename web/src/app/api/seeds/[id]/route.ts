import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getSeedDetail, setSeedVisibility, deleteSeed, updateSeed } from "@/lib/services/seeds";
import { patchSeedSchema } from "@/lib/validation";

// GET /api/seeds/:id — seed detail + stage distribution + contributions.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await getSeedDetail(userId, ctx.params.id));
});

// PATCH /api/seeds/:id — edit the question/framing and/or change visibility
// (creator / seed steward only).
export const PATCH = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = patchSeedSchema.parse(await req.json());
  if (body.title !== undefined || body.content !== undefined) {
    await updateSeed(userId, ctx.params.id, { title: body.title, content: body.content });
  }
  const result =
    body.visibility !== undefined
      ? await setSeedVisibility(userId, ctx.params.id, body.visibility)
      : { id: ctx.params.id };
  return ok({ ...result, title: body.title, content: body.content });
});

// DELETE /api/seeds/:id — soft-delete the seed (creator / steward).
export const DELETE = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await deleteSeed(userId, ctx.params.id));
});
