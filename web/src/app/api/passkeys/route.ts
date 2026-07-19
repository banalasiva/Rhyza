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
  // Scope the delete to the owner so you can only remove your own.
  const res = await db.passkey.deleteMany({ where: { id, userId } });
  if (res.count === 0) throw new ApiError("NOT_FOUND", "Passkey not found");
  return ok({ ok: true });
});
