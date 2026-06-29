import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { enforceAiRateLimit } from "@/lib/ratelimit";
import { summarizeSeed } from "@/lib/services/contributions";

// POST /api/seeds/:id/summary — ask Claude or ChatGPT to summarize the whole
// discussion, organised by dimension. Read-only (nothing is posted).
// Body: { provider?: "claude" | "chatgpt" }. Returns { text, provider }.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  await enforceAiRateLimit(userId);
  const body = (await req.json().catch(() => ({}))) as { provider?: "claude" | "chatgpt" };
  const provider = body.provider === "chatgpt" ? "chatgpt" : "claude";
  const text = await summarizeSeed(userId, ctx.params.id, provider);
  if (!text) {
    throw new ApiError(
      "BAD_REQUEST",
      provider === "chatgpt"
        ? "ChatGPT isn't configured — set OPENAI_API_KEY to enable summaries."
        : "Claude isn't configured — set ANTHROPIC_API_KEY to enable summaries.",
    );
  }
  return ok({ text, provider });
});
