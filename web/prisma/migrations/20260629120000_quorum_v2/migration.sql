-- Quorum v2 — "emotions → maths". Everyone ranks everyone on six fixed
-- dimensions; the pure engine in lib/quorum.ts turns those ballots into a
-- weight per person. These tables hold the inputs (ballots, admin hardcodes)
-- and the board phase. The legacy stake_* tables are left untouched.
--
-- Written idempotently (CREATE TABLE IF NOT EXISTS, inline constraints) so the
-- same statements can be applied either by `prisma migrate deploy` or by the
-- owner-only /api/admin/migrate endpoint (lib/pending-ddl.ts) without either
-- path colliding with the other.

-- One rater's ordered ballot for one dimension. ranking = JSON array of
-- rateeIds, best first.
CREATE TABLE IF NOT EXISTS "quorum_ballots" (
  "seed_id"    UUID    NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "rater_id"   UUID    NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "dimension"  TEXT    NOT NULL,
  "ranking"    JSONB   NOT NULL DEFAULT '[]',
  "submitted"  BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("seed_id", "rater_id", "dimension")
);
CREATE INDEX IF NOT EXISTS "quorum_ballots_seed_id_idx" ON "quorum_ballots" ("seed_id");

-- An admin's hardcode of a measurable dimension. shares = JSON map
-- userId -> positive number (normalised by the engine).
CREATE TABLE IF NOT EXISTS "quorum_hardcodes" (
  "seed_id"    UUID    NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "dimension"  TEXT    NOT NULL,
  "by_id"      UUID    NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "shares"     JSONB   NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("seed_id", "dimension")
);
CREATE INDEX IF NOT EXISTS "quorum_hardcodes_seed_id_idx" ON "quorum_hardcodes" ("seed_id");

-- Per-seed quorum phase: collecting -> revealed -> locked.
CREATE TABLE IF NOT EXISTS "quorum_state" (
  "seed_id"    UUID    NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "phase"      TEXT    NOT NULL DEFAULT 'collecting',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("seed_id")
);
