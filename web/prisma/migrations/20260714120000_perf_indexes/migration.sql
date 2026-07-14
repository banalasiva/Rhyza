-- Cover hot read paths that lacked a matching index. On a large table prefer the
-- CONCURRENTLY variant by hand to avoid a write lock.
CREATE INDEX IF NOT EXISTS "contributions_author_id_deleted_at_idx"
  ON "contributions" ("author_id", "deleted_at");
CREATE INDEX IF NOT EXISTS "bloom_contributors_user_id_idx"
  ON "bloom_contributors" ("user_id");
CREATE INDEX IF NOT EXISTS "notifications_recipient_unread_idx"
  ON "notifications" ("recipient_id") WHERE "read_at" IS NULL;
