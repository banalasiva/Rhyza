-- Quorum v2 — "emotions → maths". Everyone ranks everyone on six fixed
-- dimensions; the pure engine in lib/quorum.ts turns those ballots into a
-- weight per person. These tables hold the inputs (ballots, admin hardcodes)
-- and the board phase. The legacy stake_* tables are left untouched.

-- One rater's ordered ballot for one dimension. ranking = JSON array of
-- rateeIds, best first.
CREATE TABLE "quorum_ballots" (
  "seed_id"    UUID    NOT NULL,
  "rater_id"   UUID    NOT NULL,
  "dimension"  TEXT    NOT NULL,
  "ranking"    JSONB   NOT NULL DEFAULT '[]',
  "submitted"  BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quorum_ballots_pkey" PRIMARY KEY ("seed_id", "rater_id", "dimension")
);
CREATE INDEX "quorum_ballots_seed_id_idx" ON "quorum_ballots" ("seed_id");
ALTER TABLE "quorum_ballots"
  ADD CONSTRAINT "quorum_ballots_seed_id_fkey"
  FOREIGN KEY ("seed_id") REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quorum_ballots"
  ADD CONSTRAINT "quorum_ballots_rater_id_fkey"
  FOREIGN KEY ("rater_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- An admin's hardcode of a measurable dimension. shares = JSON map
-- userId -> positive number (normalised by the engine).
CREATE TABLE "quorum_hardcodes" (
  "seed_id"    UUID    NOT NULL,
  "dimension"  TEXT    NOT NULL,
  "by_id"      UUID    NOT NULL,
  "shares"     JSONB   NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quorum_hardcodes_pkey" PRIMARY KEY ("seed_id", "dimension")
);
CREATE INDEX "quorum_hardcodes_seed_id_idx" ON "quorum_hardcodes" ("seed_id");
ALTER TABLE "quorum_hardcodes"
  ADD CONSTRAINT "quorum_hardcodes_seed_id_fkey"
  FOREIGN KEY ("seed_id") REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quorum_hardcodes"
  ADD CONSTRAINT "quorum_hardcodes_by_id_fkey"
  FOREIGN KEY ("by_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-seed quorum phase: collecting -> revealed -> locked.
CREATE TABLE "quorum_state" (
  "seed_id"    UUID    NOT NULL,
  "phase"      TEXT    NOT NULL DEFAULT 'collecting',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quorum_state_pkey" PRIMARY KEY ("seed_id")
);
ALTER TABLE "quorum_state"
  ADD CONSTRAINT "quorum_state_seed_id_fkey"
  FOREIGN KEY ("seed_id") REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
