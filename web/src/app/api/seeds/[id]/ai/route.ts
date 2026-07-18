import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { setSeedAi } from "@/lib/services/ai-settings";

// POST /api/seeds/:id/ai { enabled } — owner/admin turns the seed's AI helpers
// (labelling, replies, opener, mediation, summaries) on or off.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const { enabled } = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  return ok(await setSeedAi(userId, ctx.params.id, enabled !== false));
});
