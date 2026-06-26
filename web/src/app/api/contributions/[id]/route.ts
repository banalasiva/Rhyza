import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { editContributionSchema } from "@/lib/validation";
import { editContribution, deleteContribution } from "@/lib/services/contributions";

// PATCH /api/contributions/:id — edit text (author only).
export const PATCH = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = editContributionSchema.parse(await req.json());
  return ok(await editContribution(userId, ctx.params.id, body.text));
});

// DELETE /api/contributions/:id — soft delete (author or steward).
export const DELETE = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await deleteContribution(userId, ctx.params.id));
});
