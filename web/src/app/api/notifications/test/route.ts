import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { db } from "@/lib/db";
import { pushConfigured, sendPushToUser } from "@/lib/push";
import { emailConfigured, appUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET /api/notifications/test — self-diagnostic. Sends a test push + test email
// to the LOGGED-IN user only (never anyone else, so it's safe) and reports
// exactly what is and isn't configured. Open it in the browser while signed in.
export const GET = handle(async () => {
  const userId = await requireUserId();

  // User + prefs (also confirms the delivery migration's columns exist).
  let user: { email: string | null; name: string; emailNotify: boolean; pushNotify: boolean } | null =
    null;
  let userError: string | null = null;
  try {
    user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, emailNotify: true, pushNotify: true },
    });
  } catch (e) {
    userError = e instanceof Error ? e.message : String(e);
  }

  // Push subscriptions (confirms the push_subscriptions table exists + that the
  // bell actually saved a subscription for this device).
  let subscriptions = -1;
  let subsError: string | null = null;
  try {
    subscriptions = await db.pushSubscription.count({ where: { userId } });
  } catch (e) {
    subsError = e instanceof Error ? e.message : String(e);
  }

  // Try an actual push.
  let pushSent = 0;
  let pushError: string | null = null;
  try {
    pushSent = await sendPushToUser(userId, {
      title: "ThinkThru test 🔔",
      body: "If you can see this, push notifications work.",
      url: "/notifications",
    });
  } catch (e) {
    pushError = e instanceof Error ? e.message : String(e);
  }

  // Try an actual email — call Resend directly so we surface the REAL error
  // (domain not verified, from-address not allowed, bad key, etc.).
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "ThinkThru <onboarding@resend.dev>";
  let emailHttpStatus: number | null = null;
  let emailResponse: string | null = null;
  if (apiKey && user?.email) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: user.email,
          subject: "ThinkThru email test ✅",
          html: `<p>If you can read this, ThinkThru email delivery is working. 🌱</p>`,
        }),
      });
      emailHttpStatus = res.status;
      emailResponse = (await res.text()).slice(0, 500);
    } catch (e) {
      emailResponse = e instanceof Error ? e.message : String(e);
    }
  }

  return ok({
    user: { email: user?.email ?? null, emailNotify: user?.emailNotify, pushNotify: user?.pushNotify, userError },
    push: {
      configured: pushConfigured(), // false ⇒ VAPID env vars missing in the build
      subscriptions, // 0 ⇒ the bell never saved a subscription; -1 ⇒ table/query error
      subsError,
      sent: pushSent, // how many devices we pushed to just now
      error: pushError,
    },
    email: {
      configured: emailConfigured(), // false ⇒ RESEND_API_KEY missing in the build
      from,
      sentTo: user?.email ?? null,
      httpStatus: emailHttpStatus, // 200 ⇒ accepted by Resend; 4xx ⇒ see response
      response: emailResponse,
    },
    appUrl: appUrl(),
  });
});
