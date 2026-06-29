-- Phase 2 of Explore: topic tags on public seeds + per-person interests, matched
-- to personalise the feed and notify on new matching seeds. Both are their own
-- tables so they never disturb the default row shape of seeds / users.

CREATE TABLE IF NOT EXISTS "seed_topics" (
  "seed_id" UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "topic"   TEXT NOT NULL,
  PRIMARY KEY ("seed_id", "topic")
);
CREATE INDEX IF NOT EXISTS "seed_topics_topic_idx" ON "seed_topics" ("topic");

CREATE TABLE IF NOT EXISTS "user_interests" (
  "user_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "topic"   TEXT NOT NULL,
  PRIMARY KEY ("user_id", "topic")
);
CREATE INDEX IF NOT EXISTS "user_interests_topic_idx" ON "user_interests" ("topic");
