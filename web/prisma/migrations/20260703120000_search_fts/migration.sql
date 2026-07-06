-- Full-text search index on message bodies (contributions.content->>'text').
-- Functional GIN index using the immutable 2-arg to_tsvector, so message search
-- is case-insensitive, word-stemmed, relevance-ranked, and stays fast as the
-- number of messages grows.
CREATE INDEX IF NOT EXISTS "contributions_text_fts"
  ON "contributions"
  USING GIN (to_tsvector('english', coalesce("content"->>'text', '')));
