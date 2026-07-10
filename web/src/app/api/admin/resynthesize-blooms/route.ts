import { handle, ok, ApiError } from "@/lib/api";
import { getViewer } from "@/lib/session";
import { isAppOwner } from "@/lib/admin";
import { resynthesizeAllBlooms } from "@/lib/services/blooms";

export const dynamic = "force-dynamic";
// Re-synthesizing can take a while when there are many blooms — give it room.
export const maxDuration = 300;

// GET /api/admin/resynthesize-blooms?fire=1 — owner-only: rebuild every
// AI-synthesized bloom with the current format. Human-edited blooms are left
// untouched. Without ?fire=1 it just reports it's ready.
export const GET = handle(async (req) => {
  const viewer = await getViewer();
  if (!viewer || !isAppOwner(viewer.email)) throw new ApiError("FORBIDDEN", "Owners only.");

  if (new URL(req.url).searchParams.get("fire") !== "1") {
    return ok({ ready: true, note: "Add ?fire=1 to re-synthesize all AI blooms now." });
  }

  return ok({ fired: true, ...(await resynthesizeAllBlooms()) });
});
