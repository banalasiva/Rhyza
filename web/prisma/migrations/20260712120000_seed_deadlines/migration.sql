-- A "rhythm" the group sets on a seed: timed phases ("2 days to discuss, 1 day
-- to decide") with Claude follow-ups, or the deliberate "peaceful" no-deadline
-- mode. One row per seed.
CREATE TABLE IF NOT EXISTS "seed_deadlines" (
  "seed_id"          UUID    NOT NULL,
  "mode"             TEXT    NOT NULL DEFAULT 'paced',
  "discuss_by"       TIMESTAMP(3),
  "decide_by"        TIMESTAMP(3),
  "set_by"           UUID    NOT NULL,
  "last_followup_at" TIMESTAMP(3),
  "followup_stage"   TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seed_deadlines_pkey" PRIMARY KEY ("seed_id")
);

CREATE INDEX IF NOT EXISTS "seed_deadlines_decide_by_idx" ON "seed_deadlines" ("decide_by");

ALTER TABLE "seed_deadlines"
  ADD CONSTRAINT "seed_deadlines_seed_id_fkey"
  FOREIGN KEY ("seed_id") REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seed_deadlines"
  ADD CONSTRAINT "seed_deadlines_set_by_fkey"
  FOREIGN KEY ("set_by") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
