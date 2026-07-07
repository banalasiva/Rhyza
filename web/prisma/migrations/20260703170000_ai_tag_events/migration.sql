-- Silent usage meter: one row per @claude / @chatgpt tag.
CREATE TABLE IF NOT EXISTS "ai_tag_events" (
  "id"         UUID NOT NULL,
  "user_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "provider"   TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_tag_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_tag_events_user_id_created_at_idx" ON "ai_tag_events" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_tag_events_created_at_idx" ON "ai_tag_events" ("created_at");
