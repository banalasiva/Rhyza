import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId, primaryOrgId } from "@/lib/authz";
import { createSeedSchema } from "@/lib/validation";
import { ensureDefaultGarden } from "@/lib/services/gardens";
import { plantSeed } from "@/lib/services/seeds";
import { kickstartSeed } from "@/lib/services/contributions";

// POST /api/seeds — "just start" plant. No garden to choose: the seed lands in
// the person's personal default garden (auto-created on first use), so a
// newcomer can go from a blank mind to a live question in one step, the way you
// start a WhatsApp chat. Organising into a named garden stays available via the
// per-garden plant path; this is simply the frictionless default.
export const maxDuration = 60;

export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const orgId = await primaryOrgId(userId);
  if (!orgId) throw new ApiError("FORBIDDEN", "Join or create an organization first");
  const body = createSeedSchema.parse(await req.json());
  const garden = await ensureDefaultGarden(userId, orgId);
  const seed = await plantSeed(userId, garden.id, body);
  void kickstartSeed(seed.id);
  return ok({ id: seed.id, title: seed.title }, 201);
});
