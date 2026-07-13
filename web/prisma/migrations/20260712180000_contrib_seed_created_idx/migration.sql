-- The hottest query in the app: thread reads and the 4s sync poll filter by
-- seed_id and ORDER BY created_at. This composite index serves both the filter
-- and the sort. On a large existing table, run the CONCURRENTLY variant by hand
-- to avoid a write lock:
--   CREATE INDEX CONCURRENTLY "contributions_seed_id_created_at_idx"
--     ON "contributions" ("seed_id", "created_at");
CREATE INDEX IF NOT EXISTS "contributions_seed_id_created_at_idx"
  ON "contributions" ("seed_id", "created_at");
