import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { enforceAiRateLimit } from "@/lib/ratelimit";
import { mediateSeed } from "@/lib/services/contributions";

// POST /api/seeds/:id/mediate — ask Claude or ChatGPT to mediate the discussion.
// Body: { provider?: "claude" | "chatgpt" }. Returns the mediation posted as that
// AI's contribution in the Debate dimension.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  await enforceAiRateLimit(userId);
  const body = (await req.json().catch(() => ({}))) as { provider?: "claude" | "chatgpt" };
  const provider = body.provider === "chatgpt" ? "chatgpt" : "claude";
  const c = await mediateSeed(userId, ctx.params.id, provider);
  if (!c) {
    throw new ApiError(
      "BAD_REQUEST",
      provider === "chatgpt"
        ? "ChatGPT isn't configured — set OPENAI_API_KEY to enable its mediation."
        : "Claude isn't configured — set ANTHROPIC_API_KEY to enable mediation.",
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
