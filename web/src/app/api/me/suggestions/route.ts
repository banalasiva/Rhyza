import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { db } from "@/lib/db";
import { suggestedConnections } from "@/lib/services/members";
import { listPublicGardens } from "@/lib/services/explore";

export const dynamic = "force-dynamic";

// GET /api/me/suggestions — the discovery pool woven into the feed as
// "Suggested for you": people you can connect with, and public gardens you're
// not in yet. Kept lightweight; the client chunks and interleaves it.
export const GET = handle(async () => {
  const userId = await requireUserId();
  const [people, allGardens, myGardens] = await Promise.all([
    suggestedConnections(userId, 18).catch(() => []),
    listPublicGardens(24).catch(() => []),
    db.gardenMember.findMany({ where: { userId }, select: { gardenId: true } }).catch(() => []),
  ]);
  const mine = new Set((myGardens as { gardenId: string }[]).map((g) => g.gardenId));
  const gardens = allGardens.filter((g) => !mine.has(g.id)).slice(0, 12);
  return ok({ people, gardens });
});
