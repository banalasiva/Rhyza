import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { backfillSeedTopics } from "@/lib/services/explore";

export const dynamic = "force-dynamic";

// POST /api/admin/backfill-topics — tag a batch of untagged seeds (app owner
// only). Returns how many were tagged and how many still remain.
export const POST = handle(async () => {
  await requireAdmin();
  return ok(await backfillSeedTopics(15));
});
