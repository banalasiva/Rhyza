import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { mediateSeed } from "@/lib/services/contributions";

// POST /api/seeds/:id/mediate — ask Claude to mediate the discussion. Returns
// the mediation posted as a Claude contribution in the Debate dimension.
export const POST = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const c = await mediateSeed(userId, ctx.params.id);
  if (!c) {
    throw new ApiError(
      "BAD_REQUEST",
      "Claude isn't configured — set ANTHROPIC_API_KEY to enable mediation.",
    );
  }
  return ok(
    {
      id: c.id,
      dimension: c.dimension,
      text: (c.content as { text?: string }).text ?? "",
      parentId: c.parentId,
      author: c.author,
      createdAt: c.createdAt.toISOString(),
    },
    201,
  );
});
