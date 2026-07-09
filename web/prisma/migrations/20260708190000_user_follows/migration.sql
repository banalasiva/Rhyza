CREATE TABLE IF NOT EXISTS "user_follows" (
  "follower_id"  UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "following_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_follows_pkey" PRIMARY KEY ("follower_id", "following_id")
);
CREATE INDEX IF NOT EXISTS "user_follows_following_id_idx" ON "user_follows" ("following_id");
