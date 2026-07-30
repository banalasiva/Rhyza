-- The "You" tab (getMyRoots) and public profiles read bloom_contributors by
-- user_id, newest first. The only existing index is UNIQUE(bloom_id, user_id),
-- which leads with bloom_id and so cannot serve a user_id-only filter — every
-- profile load sequential-scanned the table. This composite matches the query.
CREATE INDEX "bloom_contributors_user_id_added_at_idx" ON "bloom_contributors"("user_id", "added_at");
