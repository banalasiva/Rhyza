import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { submitCalibration } from "@/lib/services/calibration";

// POST /api/calibrate/:token — a signed-in person records how the decision
// landed for them. Requires sign-in (keeps it one-per-person and converts a
// newcomer who opened the link into a member).
export const POST = handle(async (req, ctx: { params: { token: string } }) => {
  const userId = await requireUserId();
  const body = (await req.json().catch(() => ({}))) as {
    outcome?: string | null;
    sameAgain?: string | null;
    note?: string | null;
  };
  const res = await submitCalibration(userId, ctx.params.token, body);
  if (!res.ok) throw new ApiError("FORBIDDEN", "This link isn't open to you.");
  return ok(res);
});
