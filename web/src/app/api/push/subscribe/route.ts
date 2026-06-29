import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { db } from "@/lib/db";
import { z } from "zod";

const subSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().max(500), auth: z.string().max(500) }),
});

// POST /api/push/subscribe — store this device's Web Push subscription. Upserts
// on the endpoint so re-subscribing the same browser just refreshes the keys
// (and re-points it at the current user). Turns push on for the account.
export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const parsed = subSchema.safeParse(await req.json());
  if (!parsed.success) throw new ApiError("BAD_REQUEST", "Invalid subscription");
  const { endpoint, keys } = parsed.data;
  const userAgent = (req.headers.get("user-agent") || "").slice(0, 300) || null;

  // The user_agent column may not be migrated yet — fall back without it.
  try {
    await db.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    });
  } catch {
    await db.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
  }
  await db.user.update({ where: { id: userId }, data: { pushNotify: true } });
  return ok({ subscribed: true });
});

// DELETE /api/push/subscribe — drop this device's subscription (e.g. the person
// turned notifications off in the browser).
export const DELETE = handle(async (req) => {
  const userId = await requireUserId();
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(await req.json());
  if (!parsed.success) throw new ApiError("BAD_REQUEST", "Invalid endpoint");
  // Scope to the caller's own subscriptions so you can only remove your own
  // device, never someone else's by guessing their endpoint.
  await db.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId } });
  return ok({ unsubscribed: true });
});
