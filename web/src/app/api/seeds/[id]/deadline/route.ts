import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUserId, requireSeedAccess, requireSeedManager } from "@/lib/authz";
import { getDeadline, setDeadline, clearDeadline } from "@/lib/services/deadlines";

export const dynamic = "force-dynamic";

// GET /api/seeds/:id/deadline — the current rhythm (or null), for anyone with
// access to the seed.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  await requireSeedAccess(userId, ctx.params.id);
  return ok(await getDeadline(ctx.params.id));
});

const bodySchema = z.object({
  mode: z.enum(["paced", "peaceful", "clear"]),
  discussDays: z.number().min(0).max(30).optional(),
  decideDays: z.number().min(0).max(30).optional(),
});

// POST /api/seeds/:id/deadline — a steward sets the rhythm: paced (with day
// counts), peaceful (no deadline, recorded), or clear (remove it).
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  await requireSeedManager(userId, ctx.params.id);
  const body = bodySchema.parse(await req.json());
  if (body.mode === "clear") {
    await clearDeadline(ctx.params.id);
    return ok(null);
  }
  return ok(
    await setDeadline(ctx.params.id, userId, {
      mode: body.mode,
      discussDays: body.discussDays,
      decideDays: body.decideDays,
    }),
  );
});
