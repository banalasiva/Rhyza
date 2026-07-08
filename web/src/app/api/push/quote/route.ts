import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { enforceRateLimit } from "@/lib/ratelimit";
import { pushConfigured, sendPushDetailed } from "@/lib/push";
import { resolveMessageOfTheDay } from "@/lib/services/daily";

export const dynamic = "force-dynamic";

// POST /api/push/quote — push TODAY's quote to the caller's own devices, on
// demand. Lets a person feel the daily "Good morning 🌱" push right now (and
// confirm it works) instead of waiting for the morning cron. Self-targeted and
// rate-limited.
export const POST = handle(async () => {
  const userId = await requireUserId();
  await enforceRateLimit(`pushquote:${userId}`, 5, 60);

  if (!pushConfigured()) {
    throw new ApiError("BAD_REQUEST", "Push isn't set up on this server yet (VAPID keys missing).");
  }

  const msg = await resolveMessageOfTheDay();
  const body = msg.author ? `“${msg.text}” — ${msg.author}` : msg.text;

  const r = await sendPushDetailed(userId, { title: "Good morning 🌱", body, url: "/" });

  if (r.devices === 0) {
    throw new ApiError(
      "BAD_REQUEST",
      "No device is subscribed yet. Turn on notifications above and allow them, then try again.",
    );
  }
  if (r.sent === 0) {
    const codes = [...new Set(r.failures.map((f) => f.status ?? "?"))].join(", ");
    throw new ApiError(
      "BAD_REQUEST",
      `Push was rejected by all ${r.devices} device(s) (status ${codes}). If it's 403, turn notifications off then on again.`,
    );
  }
  return ok({ sent: r.sent, devices: r.devices });
});
