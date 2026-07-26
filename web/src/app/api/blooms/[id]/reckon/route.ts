import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getReckoning, castReckoning, openReckoning } from "@/lib/services/reckoning";

// GET  /api/blooms/:id/reckon — the viewer's view of this bloom's reckoning.
// POST { action: "open" }                  — open the reckoning early ("look back now").
// POST { verdict: "well"|"mixed"|"regret", note? } — cast (or change) a verdict.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await getReckoning(userId, ctx.params.id));
});

export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.action === "open") {
    return ok(await openReckoning(userId, ctx.params.id));
  }
  return ok(await castReckoning(userId, ctx.params.id, String(body.verdict ?? ""), body.note));
});
