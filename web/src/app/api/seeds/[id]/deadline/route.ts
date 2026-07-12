import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUserId, requireSeedAccess, requireSeedManager } from "@/lib/authz";
import {
  getDeadline,
  setDeadline,
  clearDeadline,
  extendDeadline,
  endPhase,
} from "@/lib/services/deadlines";

export const dynamic = "force-dynamic";

// GET /api/seeds/:id/deadline — the current rhythm (or null), for anyone with
// access to the seed.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  await requireSeedAccess(userId, ctx.params.id);
  return ok(await getDeadline(ctx.params.id));
});

const bodySchema = z.union([
  z.object({
    mode: z.enum(["paced", "peaceful", "clear"]),
    discussDays: z.number().min(0).max(30).optional(),
    decideDays: z.number().min(0).max(30).optional(),
  }),
  // Add time to the current phase, in minutes (max 30 days).
  z.object({ action: z.literal("extend"), minutes: z.number().min(1).max(43200) }),
  // Freeze the current phase now (discussion or decision time).
  z.object({ action: z.literal("end") }),
]);

// POST /api/seeds/:id/deadline — a steward sets or steers the rhythm: set it
// (paced / peaceful / clear), extend the current phase, or freeze it now.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  await requireSeedManager(userId, ctx.params.id);
  const body = bodySchema.parse(await req.json());

  if ("action" in body) {
    if (body.action === "extend") return ok(await extendDeadline(ctx.params.id, body.minutes));
    return ok(await endPhase(ctx.params.id));
  }
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
