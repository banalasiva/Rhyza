-- Unsent message drafts per (seed, user). Its own table, no FKs to hot tables
-- beyond seed/user, read best-effort so a missing table never blocks a seed.
CREATE TABLE IF NOT EXISTS "seed_drafts" (
  "seed_id"     UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "user_id"     UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "text"        TEXT NOT NULL DEFAULT '',
  "attachments" JSONB,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seed_drafts_pkey" PRIMARY KEY ("seed_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "seed_drafts_user_id_updated_at_idx"
  ON "seed_drafts" ("user_id", "updated_at");
