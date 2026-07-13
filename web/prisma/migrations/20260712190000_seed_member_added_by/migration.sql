-- Track who added a seat and whether the adder was a stranger (not in the
-- added person's circle), so the seed room can show a "you were added by
-- someone you don't know — leave?" banner. Open discoverability with
-- consent-after-the-fact.
ALTER TABLE "seed_members" ADD COLUMN IF NOT EXISTS "added_by" UUID;
ALTER TABLE "seed_members" ADD COLUMN IF NOT EXISTS "added_by_stranger" BOOLEAN NOT NULL DEFAULT false;
