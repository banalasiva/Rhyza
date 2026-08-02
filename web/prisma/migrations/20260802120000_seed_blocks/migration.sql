-- Per-seed removal ("remove from seed" by an owner/admin). Its own table (not a
-- role on the hot seed_members table) so core seed reads never select a column an
-- un-migrated DB lacks. A block denies seed access even for a public seed (whose
-- access otherwise comes from the garden) and hides the person from the roster.
-- FK cascades keep it clean when the seed or user is deleted.
CREATE TABLE IF NOT EXISTS "seed_blocks" (
  "seed_id"    UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "user_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "blocked_by" UUID REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seed_blocks_pkey" PRIMARY KEY ("seed_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "seed_blocks_seed_id_idx" ON "seed_blocks" ("seed_id");
