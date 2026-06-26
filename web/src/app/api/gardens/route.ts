import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId, primaryOrgId } from "@/lib/authz";
import { createGardenSchema } from "@/lib/validation";
import { listGardens, createGarden } from "@/lib/services/gardens";

// GET /api/gardens — gardens in the user's org.
export const GET = handle(async () => {
  const userId = await requireUserId();
  const orgId = await primaryOrgId(userId);
  if (!orgId) throw new ApiError("FORBIDDEN", "Join or create an organization first");
  return ok({ gardens: await listGardens(userId, orgId) });
});

// POST /api/gardens — create a garden.
export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const orgId = await primaryOrgId(userId);
  if (!orgId) throw new ApiError("FORBIDDEN", "Join or create an organization first");
  const body = createGardenSchema.parse(await req.json());
  const garden = await createGarden(userId, orgId, body);
  return ok({ id: garden.id, slug: garden.slug, name: garden.name }, 201);
});
