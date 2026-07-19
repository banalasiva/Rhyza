import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { db } from "@/lib/db";

// GET /api/passkeys — list the signed-in user's passkeys (for the settings UI).
export const GET = handle(async () => {
  const userId = await requireUserId();
  const rows = await db.passkey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true, backedUp: true },
  });
  return ok({
    passkeys: rows.map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt.toISOString(),
      lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
      backedUp: p.backedUp,
    })),
  });
});

// DELETE /api/passkeys?id=... — remove one of your own passkeys.
export const DELETE = handle(async (req) => {
  const userId = await requireUserId();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new ApiError("BAD_REQUEST", "Missing passkey id");

  // Ownership check first (scopes everything below to this user's own keys).
  const own = await db.passkey.findFirst({ where: { id, userId }, select: { id: true } });
  if (!own) throw new ApiError("NOT_FOUND", "Passkey not found");

  // Lockout guard: never let someone strand themselves. If this is their LAST
  // passkey, only allow removal when they still have another way in — a linked
  // Google/SSO account, or a real email that can receive a magic link. A
  // synthetic phone-login email (phone_*@phone.thinkthru.app) doesn't count.
  const count = await db.passkey.count({ where: { userId } });
  if (count <= 1) {
    const [oauth, user] = await Promise.all([
      db.account.count({ where: { userId } }),
      db.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);
    const realEmail = !!user?.email && !user.email.endsWith("@phone.thinkthru.app");
    if (!oauth && !realEmail) {
      throw new ApiError(
        "BAD_REQUEST",
        "This is your only way to sign in. Link Google or an email first, then you can remove this passkey.",
      );
    }
  }

  await db.passkey.delete({ where: { id } });
  return ok({ ok: true });
});
