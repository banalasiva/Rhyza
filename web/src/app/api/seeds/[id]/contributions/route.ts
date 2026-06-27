import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { createContributionSchema } from "@/lib/validation";
import { addContribution, respondAsClaude } from "@/lib/services/contributions";
import { aiConfigured, mentionsClaude } from "@/lib/ai";

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

  let aiReply = null;
  // null = wasn't tagged; "not_configured" = no key; any other string = the
  // actual API error so the user sees why Claude didn't reply.
  let aiError: string | null = null;
  if (mentionsClaude(body.text)) {
    if (!aiConfigured()) {
      aiError = "not_configured";
    } else {
      try {
        const claudeContribution = await respondAsClaude(
          ctx.params.id,
          body.dimension,
          body.text,
          c.id,
        );
        if (claudeContribution) aiReply = toDTO(claudeContribution);
        else aiError = "Claude returned an empty reply";
      } catch (err) {
        aiError = err instanceof Error ? err.message : "Claude request failed";
      }
    }
  }

  return ok({ ...toDTO(c), aiReply, aiError }, 201);
});
