-- Request-to-join for private seeds: a shared link lets someone knock; an owner
-- or steward approves. Leaked links can't grant access on their own.
CREATE TABLE IF NOT EXISTS "seed_join_requests" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "seed_id"    UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "user_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "status"     TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    CONSTRAINT "seed_join_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "seed_join_requests_seed_id_user_id_key" ON "seed_join_requests" ("seed_id", "user_id");
CREATE INDEX IF NOT EXISTS "seed_join_requests_seed_id_status_idx" ON "seed_join_requests" ("seed_id", "status");
