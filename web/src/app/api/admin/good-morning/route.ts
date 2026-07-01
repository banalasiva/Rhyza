import { handle, ok, ApiError } from "@/lib/api";
import { getViewer } from "@/lib/session";
import { sendGoodMorning } from "@/lib/services/morning";

export const dynamic = "force-dynamic";

// GET /api/admin/good-morning?fire=1 — owner-only manual trigger for the daily
// "Good morning 🌱" push, so you can send it right now instead of waiting for
// the 08:00 cron. Without ?fire=1 it just reports it's ready (a dry check).
// Gated to ADMIN_EMAILS (fails closed). Open it on your phone while signed in.
export const GET = handle(async (req) => {
  const viewer = await getViewer();
  if (!viewer) throw new ApiError("UNAUTHORIZED", "Sign in first.");
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) throw new ApiError("FORBIDDEN", "Set ADMIN_EMAILS to use this.");
  if (!allow.includes((viewer.email ?? "").toLowerCase())) {
    throw new ApiError("FORBIDDEN", "Not an admin on this deployment.");
  }

  if (new URL(req.url).searchParams.get("fire") !== "1") {
    return ok({ ready: true, note: "Add ?fire=1 to actually send the good-morning push now." });
  }

  const result = await sendGoodMorning();
  return ok({ fired: true, ...result });
});
