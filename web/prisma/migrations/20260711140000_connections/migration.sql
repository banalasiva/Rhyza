-- Mutual connections: request → accept. Once accepted, people are in each
-- other's circle and can be added straight into private seeds.
CREATE TABLE IF NOT EXISTS "connections" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "requester_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "addressee_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "status"       TEXT NOT NULL DEFAULT 'pending',
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "connections_requester_id_addressee_id_key" ON "connections" ("requester_id", "addressee_id");
CREATE INDEX IF NOT EXISTS "connections_addressee_id_status_idx" ON "connections" ("addressee_id", "status");
CREATE INDEX IF NOT EXISTS "connections_requester_id_status_idx" ON "connections" ("requester_id", "status");
