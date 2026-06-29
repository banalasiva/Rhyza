-- Durable fixed-window rate limiting (no Redis). One row per key; the window
-- resets when reset_at passes. Idempotent so it can be applied by either
-- `prisma migrate deploy` or the /api/admin/migrate endpoint.
CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key"      TEXT    NOT NULL,
  "count"    INTEGER NOT NULL DEFAULT 0,
  "reset_at" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("key")
);
