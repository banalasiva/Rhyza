-- In-app bug reports / ideas, captured with page + device so they're actionable.
CREATE TABLE IF NOT EXISTS "feedback" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id"    UUID REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "kind"       TEXT NOT NULL DEFAULT 'bug',
    "message"    TEXT NOT NULL,
    "path"       TEXT,
    "user_agent" TEXT,
    "status"     TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "feedback_status_created_at_idx" ON "feedback" ("status", "created_at");
