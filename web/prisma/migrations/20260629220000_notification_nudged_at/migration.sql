-- Twice-daily re-engagement push: mark notifications already summarised in a
-- morning/evening nudge so the next slot never repeats them.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "nudged_at" TIMESTAMP(3);
