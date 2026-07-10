-- Direct "asks" — one person invites another, by name, to weigh in on a seed.
CREATE TABLE IF NOT EXISTS "seed_asks" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "seed_id"     UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "asker_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "asked_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answered_at" TIMESTAMP(3),
    CONSTRAINT "seed_asks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "seed_asks_seed_id_asked_id_key" ON "seed_asks" ("seed_id", "asked_id");
CREATE INDEX IF NOT EXISTS "seed_asks_asked_id_answered_at_idx" ON "seed_asks" ("asked_id", "answered_at");
CREATE INDEX IF NOT EXISTS "seed_asks_seed_id_idx" ON "seed_asks" ("seed_id");
