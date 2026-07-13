-- A one-time "you were added by someone outside your circle" heads-up. Its own
-- table (no columns added to the hot seed_members table) so the core seed reads
-- are never asked to select a column an un-migrated DB lacks — the lockout this
-- replaces was caused by exactly that. FK cascades keep it clean on delete.
CREATE TABLE IF NOT EXISTS "seed_add_notices" (
  "seed_id"    UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "user_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "added_by"   UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seed_add_notices_pkey" PRIMARY KEY ("seed_id", "user_id")
);
