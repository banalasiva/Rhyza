import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getBloomForCalibration, submitCalibration } from "@/lib/services/calibration";

// POST /api/calibrate/:token — a signed-in person records how the decision
// landed for them. Requires sign-in (keeps it one-per-person and converts a
// newcomer who opened the link into a member).
export const POST = handle(async (req, ctx: { params: { token: string } }) => {
  const target = await getBloomForCalibration(ctx.params.token);
  if (!target) throw new ApiError("NOT_FOUND", "This link is no longer valid.");
  const userId = await requireUserId();
  const body = (await req.json().catch(() => ({}))) as {
    outcome?: string | null;
    sameAgain?: string | null;
    note?: string | null;
  };
  return ok(await submitCalibration(userId, ctx.params.token, body));
});
