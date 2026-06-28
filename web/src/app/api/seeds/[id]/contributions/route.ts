import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { createContributionSchema } from "@/lib/validation";
import {
  addContribution,
  respondAsClaude,
  respondAsChatGpt,
} from "@/lib/services/contributions";
import { aiConfigured, openaiConfigured, mentionsClaude, mentionsChatGpt } from "@/lib/ai";

function toDTO(c: {
  id: string;
  dimension: string;
  content: unknown;
  parentId: string | null;
  author: { id: string; name: string; image: string | null };
  createdAt: Date;
}) {
  const content = c.content as {
    text?: string;
    attachments?: { url: string; type: "image" | "video" | "file"; name?: string }[];
  };
  return {
    id: c.id,
    dimension: c.dimension,
    text: content.text ?? "",
    attachments: content.attachments ?? [],
    parentId: c.parentId,
    author: c.author,
    createdAt: c.createdAt.toISOString(),
  };
}

// POST /api/seeds/:id/contributions — add a contribution in a dimension.
// If it tags @claude, Claude replies inline (returned as `aiReply`).
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = createContributionSchema.parse(await req.json());
  const c = await addContribution(userId, ctx.params.id, body);

  // @claude and/or @chatgpt can both be tagged in one message — each replies.
  const aiReplies: ReturnType<typeof toDTO>[] = [];
  // "not_configured" = no key; any other string = the actual API error.
  let aiError: string | null = null;

  if (mentionsClaude(body.text)) {
    if (!aiConfigured()) aiError = "not_configured";
    else {
      try {
        const reply = await respondAsClaude(ctx.params.id, body.dimension, body.text, c.id);
        if (reply) aiReplies.push(toDTO(reply));
        else aiError = aiError ?? "Claude returned an empty reply";
      } catch (err) {
        aiError = aiError ?? (err instanceof Error ? err.message : "Claude request failed");
      }
    }
  }

  if (mentionsChatGpt(body.text)) {
    if (!openaiConfigured()) aiError = aiError ?? "not_configured";
    else {
      try {
        const reply = await respondAsChatGpt(ctx.params.id, body.dimension, body.text, c.id);
        if (reply) aiReplies.push(toDTO(reply));
        else aiError = aiError ?? "ChatGPT returned an empty reply";
      } catch (err) {
        aiError = aiError ?? (err instanceof Error ? err.message : "ChatGPT request failed");
      }
    }
  }

  return ok({ ...toDTO(c), aiReplies, aiError }, 201);
});
