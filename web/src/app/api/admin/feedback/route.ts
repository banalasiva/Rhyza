import { z } from "zod";
import { handle, ok, ApiError } from "@/lib/api";
import { getViewer } from "@/lib/session";
import { isAppOwner } from "@/lib/admin";
import { setFeedbackStatus } from "@/lib/services/feedback";

export const dynamic = "force-dynamic";

const Body = z.object({ id: z.string().uuid(), status: z.enum(["open", "resolved"]) });

// POST /api/admin/feedback { id, status } — owner-only: resolve or reopen a
// feedback item.
export const POST = handle(async (req) => {
  const viewer = await getViewer();
  if (!viewer || !isAppOwner(viewer.email)) throw new ApiError("FORBIDDEN", "Owners only.");
  const { id, status } = Body.parse(await req.json());
  return ok(await setFeedbackStatus(id, status));
});
