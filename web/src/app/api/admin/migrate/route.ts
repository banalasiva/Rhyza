import { handle, ok, ApiError } from "@/lib/api";
import { getViewer } from "@/lib/session";
import { db } from "@/lib/db";
import { PENDING_DDL } from "@/lib/pending-ddl";

// POST /api/admin/migrate — bring the database schema up to date by running the
// idempotent, additive DDL in lib/pending-ddl.ts. This exists so the owner can
// apply additive migrations from anywhere (e.g. a phone) without a laptop and
// `prisma migrate deploy`.
//
// Safety: the SQL is a FIXED list (no user input ever reaches it), every
// statement is IF NOT EXISTS / ADD COLUMN IF NOT EXISTS, and there are no
// destructive operations — so the worst a caller can do is ensure the schema is
// current. Still gated: you must be signed in, and — if ADMIN_EMAILS is set —
// your email must be on that allowlist.
export const POST = handle(async () => {
  const viewer = await getViewer();
  if (!viewer) throw new ApiError("UNAUTHORIZED", "Sign in first.");

  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length > 0 && !allow.includes((viewer.email ?? "").toLowerCase())) {
    throw new ApiError("FORBIDDEN", "Not an admin on this deployment.");
  }

  const ran: string[] = [];
  const failed: { label: string; error: string }[] = [];
  for (const stmt of PENDING_DDL) {
    try {
      await db.$executeRawUnsafe(stmt.sql);
      ran.push(stmt.label);
    } catch (err) {
      failed.push({ label: stmt.label, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return ok({ ok: failed.length === 0, ran, failed });
});
