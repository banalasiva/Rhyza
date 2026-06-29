// Web Push delivery (VAPID). Gated behind the VAPID_* env vars exactly like
// email is gated behind RESEND_API_KEY: with no keys configured, push is simply
// skipped and the rest of the app is unaffected.
//
// Generate a key pair once with:  npx web-push generate-vapid-keys
// then set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (a mailto: URL)
// in the environment. The public key is also exposed to the browser as
// NEXT_PUBLIC_VAPID_PUBLIC_KEY so the client can subscribe.

import webpush from "web-push";
import { db } from "@/lib/db";

let configured: boolean | null = null;
let configError: string | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  // setVapidDetails THROWS on malformed keys. We must never let that propagate:
  // pushConfigured() is called inside the shared deliver() path, so an
  // unguarded throw here would abort delivery entirely — taking EMAIL down with
  // push. Catch it, disable push cleanly, and let everything else proceed.
  try {
    webpush.setVapidDetails(
      (process.env.VAPID_SUBJECT || "mailto:hello@thinkthru.app").trim(),
      pub,
      priv,
    );
    configured = true;
  } catch (err) {
    configError = err instanceof Error ? err.message : String(err);
    console.error("[push] invalid VAPID keys — push disabled:", configError);
    configured = false;
  }
  return configured;
}

// Why push is off, if VAPID keys are present but invalid (for diagnostics).
export function pushConfigError(): string | null {
  pushConfigured();
  return configError;
}

export type PushPayload = {
  title: string;
  body: string;
  url: string; // where clicking the notification takes the person
  tag?: string; // collapse key so duplicates replace instead of stack
};

// Push a payload to every device a person has registered. Dead subscriptions
// (the browser unsubscribed, or the endpoint 404/410s) are pruned so we don't
// keep trying them. Best-effort: never throws to the caller.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Gone for good — drop it.
          await db.pushSubscription.delete({ where: { endpoint: s.endpoint } }).catch(() => {});
        } else {
          console.error("[push] send failed", status, err);
        }
      }
    }),
  );
  return sent;
}
