import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { db } from "@/lib/db";
import { z } from "zod";

const prefsSchema = z.object({
  emailNotify: z.boolean().optional(),
  pushNotify: z.boolean().optional(),
  digestNotify: z.boolean().optional(),
});

// GET /api/me/notification-prefs — current channel preferences.
export const GET = handle(async () => {
  const userId = await requireUserId();
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { emailNotify: true, pushNotify: true, digestNotify: true },
  });
  return ok(u ?? { emailNotify: true, pushNotify: true, digestNotify: true });
});

// PATCH /api/me/notification-prefs — toggle email / push / digest.
export const PATCH = handle(async (req) => {
  const userId = await requireUserId();
  const data = prefsSchema.parse(await req.json());
  const u = await db.user.update({
    where: { id: userId },
    data,
    select: { emailNotify: true, pushNotify: true, digestNotify: true },
  });
  return ok(u);
});
