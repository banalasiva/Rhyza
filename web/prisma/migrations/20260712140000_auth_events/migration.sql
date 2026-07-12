-- Failed/notable sign-in attempts, logged so the owner can see auth problems on
-- the admin panel. No FK to users — the person usually isn't signed in.
CREATE TABLE IF NOT EXISTS "auth_events" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "code"       TEXT NOT NULL,
  "email"      TEXT,
  "detail"     TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "auth_events_created_at_idx" ON "auth_events" ("created_at");
