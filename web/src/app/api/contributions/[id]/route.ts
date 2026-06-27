import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { editContributionSchema, retagContributionSchema } from "@/lib/validation";
import {
  editContribution,
  deleteContribution,
  retagContribution,
} from "@/lib/services/contributions";

// PATCH /api/contributions/:id — edit text (author), or re-tag its dimension.
export const PATCH = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const json = await req.json();
  if (json && typeof json.dimension === "string") {
    const body = retagContributionSchema.parse(json);
    return ok(await retagContribution(userId, ctx.params.id, body.dimension));
  }
  if (json && typeof json.text === "string") {
    const body = editContributionSchema.parse(json);
    return ok(await editContribution(userId, ctx.params.id, body.text));
  }
  throw new ApiError("BAD_REQUEST", "Provide text or dimension");
});

// DELETE /api/contributions/:id — soft delete (author or steward).
export const DELETE = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await deleteContribution(userId, ctx.params.id));
});
