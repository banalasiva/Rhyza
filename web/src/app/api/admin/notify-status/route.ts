import { handle, ok, ApiError } from "@/lib/api";
import { getViewer } from "@/lib/session";
import { db } from "@/lib/db";
import { pushConfigured, pushConfigError, sendPushDetailed } from "@/lib/push";
import { emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET /api/admin/notify-status — owner-only, read-only diagnosis of why push /
// email might not be arriving. Sends nothing; just reports what's configured on
// the server and the caller's own subscription + preferences. Open it in your
// phone browser while signed in. Gated to ADMIN_EMAILS (fails closed).
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

  const serverPub = process.env.VAPID_PUBLIC_KEY?.trim() || null;
  const clientPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;

  let subscriptions = -1;
  try {
    subscriptions = await db.pushSubscription.count({ where: { userId: viewer.userId } });
  } catch {
    /* table may be missing */
  }
  const me = await db.user
    .findUnique({
      where: { id: viewer.userId },
      select: { email: true, emailNotify: true, pushNotify: true },
    })
    .catch(() => null);

  // ?send=1 actually fires a test push to your own devices and reports each
  // device's outcome (200 = accepted; 403 = key mismatch; 404/410 = dead).
  let testSend: Awaited<ReturnType<typeof sendPushDetailed>> | null = null;
  if (new URL(req.url).searchParams.get("send") === "1") {
    testSend = await sendPushDetailed(viewer.userId, {
      title: "ThinkThru 🔔",
      body: "Diagnostic test push.",
      url: "/notifications",
    });
  }

  return ok({
    testSend,
    push: {
      vapidConfiguredServer: pushConfigured(), // VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY set & valid
      vapidPublicSet: !!serverPub,
      vapidPrivateSet: !!process.env.VAPID_PRIVATE_KEY,
      // If keys are set but invalid, this is the exact reason push is off.
      vapidError: pushConfigError(),
      clientKeySet: !!clientPub, // NEXT_PUBLIC_VAPID_PUBLIC_KEY (needed to subscribe)
      // The single most common silent failure: the key the browser subscribed
      // with must equal the server's public key, or pushes are rejected.
      clientKeyMatchesServer: !!serverPub && !!clientPub && serverPub === clientPub,
      yourSubscribedDevices: subscriptions, // 0 ⇒ this account never subscribed a device
      yourPushPref: me?.pushNotify ?? null, // false ⇒ you turned push off
    },
    email: {
      resendConfigured: emailConfigured(), // RESEND_API_KEY set
      fromSet: !!process.env.RESEND_FROM,
      yourEmail: me?.email ?? null,
      yourEmailPref: me?.emailNotify ?? null, // false ⇒ you turned email off
    },
  });
});
