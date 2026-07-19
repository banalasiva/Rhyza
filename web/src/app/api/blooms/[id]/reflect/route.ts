import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getMyReflection, saveReflection } from "@/lib/services/reflections";

// GET  /api/blooms/:id/reflect — the viewer's own reflection on this bloom.
// POST { outcome?, outcomeNote?, lesson?, sameAgain?, changed? } — save a
//      partial reflection (each section autosaves independently). Returns the
//      merged reflection.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await getMyReflection(userId, ctx.params.id));
});

export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, string | null> = {};
  for (const k of ["outcome", "outcomeNote", "lesson", "sameAgain", "changed"] as const) {
    if (k in body) patch[k] = body[k] == null ? null : String(body[k]);
  }
  return ok(await saveReflection(userId, ctx.params.id, patch));
});
