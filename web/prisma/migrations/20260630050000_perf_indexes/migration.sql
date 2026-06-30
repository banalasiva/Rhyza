-- Performance indexes for scale: keep the notification cron fan-outs and the
-- per-seed distinct-author lookups off table scans as data grows.
CREATE INDEX IF NOT EXISTS "notifications_emailed_at_created_at_idx"
  ON "notifications" ("emailed_at", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_read_at_nudged_at_created_at_idx"
  ON "notifications" ("read_at", "nudged_at", "created_at");
CREATE INDEX IF NOT EXISTS "contributions_seed_id_author_id_idx"
  ON "contributions" ("seed_id", "author_id");
