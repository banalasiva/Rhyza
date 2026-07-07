import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { backfillUserTopics } from "@/lib/services/profile";

export const dynamic = "force-dynamic";

// POST /api/admin/backfill-topics — fill in profile topics for a batch of people
// who don't have them yet (app owner only). Returns how many were filled and how
// many still remain.
export const POST = handle(async () => {
  await requireAdmin();
  return ok(await backfillUserTopics(6));
});
