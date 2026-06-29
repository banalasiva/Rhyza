import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { enforceRateLimit } from "@/lib/ratelimit";
import { pushConfigured, sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

// POST /api/push/test — send a test push to the CALLER's own devices, so anyone
// (you, or a new tester) can confirm notifications actually arrive on their
// phone. Only ever targets the signed-in user; lightly rate-limited so the
// button can't be used to spam yourself. Returns how many devices got it.
export const POST = handle(async () => {
  const userId = await requireUserId();
  await enforceRateLimit(`pushtest:${userId}`, 5, 60);

  if (!pushConfigured()) {
    throw new ApiError("BAD_REQUEST", "Push isn't set up on this server yet (VAPID keys missing).");
  }

  const sent = await sendPushToUser(userId, {
    title: "ThinkThru 🔔",
    body: "Your notifications are working — this is what they'll feel like.",
    url: "/notifications",
  });

  if (sent === 0) {
    throw new ApiError(
      "BAD_REQUEST",
      "No device is subscribed yet. Tap “Enable notifications” above and allow them, then try again.",
    );
  }
  return ok({ sent });
});
