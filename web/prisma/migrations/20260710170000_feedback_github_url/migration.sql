-- Track the GitHub issue auto-filed from a piece of feedback (if enabled).
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "github_url" TEXT;
