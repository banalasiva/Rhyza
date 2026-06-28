-- Attachments (images/videos) on polls.
ALTER TABLE "polls" ADD COLUMN "attachments" JSONB NOT NULL DEFAULT '[]';
