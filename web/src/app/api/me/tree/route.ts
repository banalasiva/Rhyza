import { handle, ok } from "@/lib/api";
import { requireUserId, primaryOrgId } from "@/lib/authz";
import { getNavTree } from "@/lib/services/gardens";

// GET /api/me/tree — the viewer's gardens + seeds for the navigation side panel.
export const GET = handle(async () => {
  const userId = await requireUserId();
  const orgId = await primaryOrgId(userId);
  if (!orgId) return ok({ gardens: [] });
  return ok({ gardens: await getNavTree(userId, orgId) });
});
