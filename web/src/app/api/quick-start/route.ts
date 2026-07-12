import { z } from "zod";
import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId, primaryOrgId } from "@/lib/authz";
import { quickStartDecision } from "@/lib/services/onboarding";

export const dynamic = "force-dynamic";

// POST /api/quick-start — the guided first decision. Body: { title }. Creates the
// first garden (if needed), plants the seed, kicks off Claude's first reply, and
// returns the seed to open.
export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const orgId = await primaryOrgId(userId);
  if (!orgId) throw new ApiError("BAD_REQUEST", "No workspace yet — try again in a moment.");
  const { title } = z.object({ title: z.string().min(4).max(200) }).parse(await req.json());
  return ok(await quickStartDecision(userId, orgId, title));
});
