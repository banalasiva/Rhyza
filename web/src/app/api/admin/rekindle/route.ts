import { handle, ok, ApiError } from "@/lib/api";
import { getViewer } from "@/lib/session";
import { rekindleStallingThreads } from "@/lib/services/rekindle";

export const dynamic = "force-dynamic";

// GET /api/admin/rekindle?fire=1 — owner-only manual trigger for the "Claude
// re-kindles quiet threads" pass, so you can test it now instead of waiting for
// the evening cron. Gated to ADMIN_EMAILS (fails closed).
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
    return ok({ ready: true, note: "Add ?fire=1 to scan for quiet threads and nudge now." });
  }

  const result = await rekindleStallingThreads();
  return ok({ fired: true, ...result });
});
