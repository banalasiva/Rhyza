import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { inviteSchema } from "@/lib/validation";
import { createSeedInvite } from "@/lib/services/invites";

// POST /api/seeds/:id/invites — invite someone to this seed (joins org + garden
// + the seed). Used for private seeds; works for public seeds too.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = inviteSchema.parse(await req.json().catch(() => ({})));
  const result = await createSeedInvite(userId, ctx.params.id, body.email);
  return ok(result, 201);
});
