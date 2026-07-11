-- The wise presence sensing the room: one live nudge per seed, shown to everyone.
CREATE TABLE IF NOT EXISTS "seed_mediator_nudges" (
    "seed_id"    UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "mode"       TEXT,
    "reason"     TEXT,
    "sensed_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seed_mediator_nudges_pkey" PRIMARY KEY ("seed_id")
);
