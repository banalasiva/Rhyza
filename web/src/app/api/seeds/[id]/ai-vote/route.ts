import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { enforceAiRateLimit } from "@/lib/ratelimit";
import { aiActionSchema } from "@/lib/validation";
import { aiVoteOnSeed } from "@/lib/services/contributions";

// POST /api/seeds/:id/ai-vote — ask Claude or ChatGPT to join the quorum: it
// posts its read and casts a stage vote. Body: { provider }.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  await enforceAiRateLimit(userId);
  const { provider } = aiActionSchema.parse(await req.json());
  const out = await aiVoteOnSeed(userId, ctx.params.id, provider);
  if (!out) {
    throw new ApiError(
      "BAD_REQUEST",
      provider === "chatgpt"
        ? "ChatGPT isn't configured — set OPENAI_API_KEY to let it vote."
        : "Claude isn't configured — set ANTHROPIC_API_KEY to let it vote.",
    );
  }
  const c = out.contribution;
  const content = c.content as { text?: string; attachments?: unknown[] };
  return ok({
    contribution: {
      id: c.id,
      dimension: c.dimension,
      text: content.text ?? "",
      attachments: content.attachments ?? [],
      parentId: c.parentId,
      author: c.author,
      createdAt: c.createdAt.toISOString(),
    },
    distribution: out.result.distribution,
    stage: out.result.stage,
    bloomed: out.result.bloomed,
    bloomId: out.result.bloomId,
  });
});
