import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { createContributionSchema } from "@/lib/validation";
import { addContribution } from "@/lib/services/contributions";

// POST /api/seeds/:id/contributions — add a contribution in a dimension.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = createContributionSchema.parse(await req.json());
  const c = await addContribution(userId, ctx.params.id, body);
  return ok(
    {
      id: c.id,
      dimension: c.dimension,
      text: (c.content as { text?: string }).text ?? "",
      author: c.author,
      createdAt: c.createdAt.toISOString(),
    },
    201,
  );
});
