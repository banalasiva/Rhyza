import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import {
  requestConnection,
  respondConnection,
  removeConnection,
} from "@/lib/services/connections";

export const dynamic = "force-dynamic";

const Body = z.object({ action: z.enum(["request", "accept", "decline", "remove"]) });

// POST /api/users/:id/connect { action } — send / accept / decline / remove a
// mutual connection with another person.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const { action } = Body.parse(await req.json());
  const otherId = ctx.params.id;
  if (action === "request") return ok(await requestConnection(userId, otherId));
  if (action === "accept") return ok(await respondConnection(userId, otherId, true));
  if (action === "decline") return ok(await respondConnection(userId, otherId, false));
  return ok(await removeConnection(userId, otherId));
});
