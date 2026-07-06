import { handle, ok, ApiError } from "@/lib/api";
import { getViewer } from "@/lib/session";
import { search, type SearchResults } from "@/lib/services/search";

export const dynamic = "force-dynamic";

// GET /api/search?q=… — search across seeds, messages, gardens, and people the
// viewer is allowed to see. Returns grouped results.
export const GET = handle(async (req) => {
  const viewer = await getViewer();
  if (!viewer) throw new ApiError("UNAUTHORIZED", "Sign in first.");
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const empty: SearchResults = { query: q, seeds: [], messages: [], gardens: [], people: [], total: 0 };
  if (!viewer.orgId) return ok(empty);
  return ok(await search(viewer.userId, viewer.orgId, q));
});
