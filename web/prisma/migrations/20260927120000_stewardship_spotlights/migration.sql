-- Path C spotlight→certify: AI-detected candidate "conflict stewardship" moments
-- awaiting certification by the person who was challenged. Its own table (never
-- touches the hot seed_members/contributions reads) so an un-migrated DB just
-- yields no spotlights. FK cascades clean it up with the seed/user/contribution.
CREATE TABLE IF NOT EXISTS "stewardship_spotlights" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "seed_id"         UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "contribution_id" UUID NOT NULL REFERENCES "contributions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "replier_id"      UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "target_id"       UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stewardship_spotlights_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "stewardship_spotlights_contribution_target_key"
  ON "stewardship_spotlights" ("contribution_id", "target_id");
CREATE INDEX IF NOT EXISTS "stewardship_spotlights_seed_target_status_idx"
  ON "stewardship_spotlights" ("seed_id", "target_id", "status");
