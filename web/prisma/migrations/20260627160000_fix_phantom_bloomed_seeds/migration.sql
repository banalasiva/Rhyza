-- Data fix: some seeds were marked stage='bloomed' by the dominant-vote logic
-- without an actual bloom ever being created (no row in "blooms", bloom_id NULL).
-- Such seeds look bloomed but are invisible in the Sacred Tree. Reopen them to
-- 'growing' so they're discoverable and interactive again. Genuinely bloomed
-- seeds (bloom_id set) are untouched.
UPDATE "seeds"
SET "stage" = 'growing'
WHERE "stage" = 'bloomed'
  AND "bloom_id" IS NULL
  AND "deleted_at" IS NULL;
