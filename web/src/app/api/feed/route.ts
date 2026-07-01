import { handle, ok, ApiError } from "@/lib/api";
import { getViewer } from "@/lib/session";
import { getFeed } from "@/lib/services/feed";

export const dynamic = "force-dynamic";

// GET /api/feed?cursor=… — the infinite home feed of seeds (private-first, then
// the public square). Returns { items, nextCursor }; a null nextCursor is the end.
export const GET = handle(async (req) => {
  const viewer = await getViewer();
  if (!viewer) throw new ApiError("UNAUTHORIZED", "Sign in first.");
  const cursor = new URL(req.url).searchParams.get("cursor");
  return ok(await getFeed(viewer.userId, viewer.orgId, cursor));
});
