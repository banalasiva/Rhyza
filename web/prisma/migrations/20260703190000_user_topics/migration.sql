CREATE TABLE IF NOT EXISTS "user_topics" (
  "user_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "topic"      TEXT NOT NULL,
  "manual"     BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_topics_pkey" PRIMARY KEY ("user_id", "topic")
);
CREATE INDEX IF NOT EXISTS "user_topics_user_id_idx" ON "user_topics" ("user_id");
