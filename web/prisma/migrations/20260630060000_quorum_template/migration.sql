-- Quorum templates: a Quorum has a purpose (decide | understand), each a curated
-- dimension set. Default keeps every existing Quorum on the "decide" set.
ALTER TABLE "quorum_state" ADD COLUMN IF NOT EXISTS "template" TEXT NOT NULL DEFAULT 'decide';
