-- People the viewer dismissed from "Suggested for you" — kept out of future
-- suggestions.
CREATE TABLE IF NOT EXISTS "suggestion_dismissals" (
  "user_id"      UUID NOT NULL,
  "dismissed_id" UUID NOT NULL,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "suggestion_dismissals_pkey" PRIMARY KEY ("user_id", "dismissed_id")
);

CREATE INDEX IF NOT EXISTS "suggestion_dismissals_user_id_idx" ON "suggestion_dismissals" ("user_id");

ALTER TABLE "suggestion_dismissals"
  ADD CONSTRAINT "suggestion_dismissals_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "suggestion_dismissals"
  ADD CONSTRAINT "suggestion_dismissals_dismissed_id_fkey"
  FOREIGN KEY ("dismissed_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
