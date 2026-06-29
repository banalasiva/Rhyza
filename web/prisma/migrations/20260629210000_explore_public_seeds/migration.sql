-- World-public seeds: discoverable on /explore across orgs, followable, with
-- a reports table for moderation. Idempotent (safe via migrate deploy or the
-- /api/admin/migrate endpoint).

ALTER TABLE "seeds" ADD COLUMN IF NOT EXISTS "listed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "seeds" ADD COLUMN IF NOT EXISTS "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "seeds_listed_last_activity_at_idx" ON "seeds" ("listed", "last_activity_at");

CREATE TABLE IF NOT EXISTS "seed_follows" (
  "seed_id"    UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "user_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("seed_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "seed_follows_user_id_idx" ON "seed_follows" ("user_id");

CREATE TABLE IF NOT EXISTS "seed_reports" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "seed_id"         UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "contribution_id" UUID,
  "reporter_id"     UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "reason"          TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'open',
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "seed_reports_status_created_at_idx" ON "seed_reports" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "seed_reports_seed_id_idx" ON "seed_reports" ("seed_id");
