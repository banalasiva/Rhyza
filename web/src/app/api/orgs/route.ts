import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { createOrgSchema } from "@/lib/validation";
import { createOrgForUser } from "@/lib/services/onboarding";

// POST /api/orgs — create an organization (onboarding).
export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const body = createOrgSchema.parse(await req.json());
  const org = await createOrgForUser(userId, body.name);
  return ok({ id: org.id, name: org.name, slug: org.slug }, 201);
});
