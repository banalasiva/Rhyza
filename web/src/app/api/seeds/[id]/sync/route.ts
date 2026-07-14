import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getSeedSync } from "@/lib/services/seeds";

// GET /api/seeds/:id/sync?since=<version> — a live snapshot of the open room.
// Always returns the cheap live bits (readiness distribution, stage, the viewer's
// vote, the mediator offer) + a `version` fingerprint. The full contributions
// array comes back only when the thread changed since `since`; otherwise
// `contributions` is null (a tiny payload). Polled by the seed page.
export const GET = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const since = new URL(req.url).searchParams.get("since") ?? undefined;
  return ok(await getSeedSync(userId, ctx.params.id, since));
});
