-- Author-scoped reads on the app's largest table (profile, roots, fingerprint,
-- "how you show up"). Postgres does not auto-index foreign keys, so these pages
-- previously sequential-scanned contributions.
CREATE INDEX "contributions_author_id_idx" ON "contributions"("author_id");

-- Creator-scoped reads (home landing, "mine" feed, profile, gardens). Same
-- reason: the createdBy FK column was not indexed.
CREATE INDEX "seeds_created_by_idx" ON "seeds"("created_by");
