import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { certifyStewardship } from "@/lib/services/stewardship";
import { z } from "zod";

const schema = z.object({ confirmed: z.boolean() });

export const dynamic = "force-dynamic";

// POST /api/stewardship/:id/certify — the challenged person confirms (or not)
// that a reply took their point seriously. Only the target may certify; on
// confirm it records the tension_holder recognition on the reply.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const { confirmed } = schema.parse(await req.json());
  return ok(await certifyStewardship(userId, ctx.params.id, confirmed));
});
