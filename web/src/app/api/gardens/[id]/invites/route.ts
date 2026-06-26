import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { inviteSchema } from "@/lib/validation";
import { createGardenInvite } from "@/lib/services/invites";

// POST /api/gardens/:id/invites — create an invite (and email it if configured).
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = inviteSchema.parse(await req.json().catch(() => ({})));
  const result = await createGardenInvite(userId, ctx.params.id, body.email);
  return ok(result, 201);
});
