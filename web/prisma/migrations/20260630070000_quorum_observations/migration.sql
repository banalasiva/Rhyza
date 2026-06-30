-- "What Claude noticed": grounded learning-moment observations stored per quorum,
-- generated once at reveal for Understand-together quorums.
ALTER TABLE "quorum_state" ADD COLUMN IF NOT EXISTS "observations" JSONB;
