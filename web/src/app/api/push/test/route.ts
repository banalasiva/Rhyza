import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { enforceRateLimit } from "@/lib/ratelimit";
import { pushConfigured, sendPushDetailed } from "@/lib/push";

export const dynamic = "force-dynamic";

// POST /api/push/test — send a test push to the CALLER's own devices, so anyone
// (you, or a new tester) can confirm notifications actually arrive on their
// phone. Only ever targets the signed-in user; lightly rate-limited so the
// button can't be used to spam yourself. Returns per-device outcomes so a
// failure (e.g. 403 = subscription bound to an old VAPID key) is visible.
export const POST = handle(async () => {
  const userId = await requireUserId();
  await enforceRateLimit(`pushtest:${userId}`, 5, 60);

  if (!pushConfigured()) {
    throw new ApiError("BAD_REQUEST", "Push isn't set up on this server yet (VAPID keys missing).");
  }

  const r = await sendPushDetailed(userId, {
    title: "ThinkThru 🔔",
    body: "Your notifications are working — this is what they'll feel like.",
    url: "/notifications",
  });

  if (r.devices === 0) {
    throw new ApiError(
      "BAD_REQUEST",
      "No device is subscribed yet. Tap “Turn on notifications” above and allow them, then try again.",
    );
  }
  // Some devices rejected the push (stale key, etc.) — report it instead of
  // pretending it worked.
  if (r.sent === 0) {
    const codes = [...new Set(r.failures.map((f) => f.status ?? "?"))].join(", ");
    throw new ApiError(
      "BAD_REQUEST",
      `Push was rejected by all ${r.devices} device(s) (status ${codes}). If it's 403, turn notifications off then on again to re-subscribe with the current key.`,
    );
  }
  return ok({ sent: r.sent, devices: r.devices, failures: r.failures });
});
