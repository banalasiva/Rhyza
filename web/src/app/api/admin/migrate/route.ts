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
// destructive operations. It is also HARD-GATED and FAILS CLOSED: the endpoint
// is disabled unless ADMIN_EMAILS is set in the environment, and then only
// those emails may call it. An unset allowlist denies everyone (never
// fail-open), so this privileged surface is off by default in production.
export const POST = handle(async () => {
  const viewer = await getViewer();
  if (!viewer) throw new ApiError("UNAUTHORIZED", "Sign in first.");

  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) {
    // Fail closed: no allowlist configured ⇒ nobody may run DDL over HTTP.
    throw new ApiError("FORBIDDEN", "Migration endpoint is disabled. Set ADMIN_EMAILS to enable it.");
  }
  if (!allow.includes((viewer.email ?? "").toLowerCase())) {
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
