import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { createContributionSchema } from "@/lib/validation";
import { addContribution, respondAsClaude } from "@/lib/services/contributions";
import { mentionsClaude } from "@/lib/ai";

function toDTO(c: {
  id: string;
  dimension: string;
  content: unknown;
  parentId: string | null;
  author: { id: string; name: string; image: string | null };
  createdAt: Date;
}) {
  return {
    id: c.id,
    dimension: c.dimension,
    text: (c.content as { text?: string }).text ?? "",
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
  if (mentionsClaude(body.text)) {
    const claudeContribution = await respondAsClaude(
      ctx.params.id,
      body.dimension,
      body.text,
      c.id,
    );
    if (claudeContribution) aiReply = toDTO(claudeContribution);
  }

  return ok({ ...toDTO(c), aiReply }, 201);
});
