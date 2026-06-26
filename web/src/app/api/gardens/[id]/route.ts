import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { updateGardenSchema } from "@/lib/validation";
import { getGardenDetail, updateGarden, deleteGarden } from "@/lib/services/gardens";

// GET /api/gardens/:id — garden detail + open seeds.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await getGardenDetail(userId, ctx.params.id));
});

// PATCH /api/gardens/:id — edit metadata (steward/creator).
export const PATCH = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = updateGardenSchema.parse(await req.json());
  const g = await updateGarden(userId, ctx.params.id, body);
  return ok({ id: g.id, name: g.name, description: g.description, emoji: g.emoji });
});

// DELETE /api/gardens/:id — delete the garden and its contents (steward/creator).
export const DELETE = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await deleteGarden(userId, ctx.params.id));
});
