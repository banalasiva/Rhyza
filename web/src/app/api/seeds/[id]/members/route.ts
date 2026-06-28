import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { seedMemberActionSchema } from "@/lib/validation";
import {
  listSeedPeople,
  setSeedAdmin,
  removeSeedMember,
  leaveSeed,
} from "@/lib/services/members";

// GET /api/seeds/:id/members — the roster with roles + whether you can manage.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await listSeedPeople(userId, ctx.params.id));
});

// POST /api/seeds/:id/members — manager action on a participant.
// Body: { targetId, action: "promote" | "demote" | "remove" }.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const { targetId, action } = seedMemberActionSchema.parse(await req.json());
  if (action === "remove") {
    return ok(await removeSeedMember(userId, ctx.params.id, targetId));
  }
  return ok(await setSeedAdmin(userId, ctx.params.id, targetId, action === "promote"));
});

// DELETE /api/seeds/:id/members — leave the seed yourself.
export const DELETE = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await leaveSeed(userId, ctx.params.id));
});
