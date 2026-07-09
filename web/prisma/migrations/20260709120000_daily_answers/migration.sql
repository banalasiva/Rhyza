-- One answer per person per day to the daily question (the daily ritual).
CREATE TABLE IF NOT EXISTS "daily_answers" (
    "day"        TEXT NOT NULL,
    "user_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "choice"     INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_answers_pkey" PRIMARY KEY ("day", "user_id")
);

CREATE INDEX IF NOT EXISTS "daily_answers_day_idx" ON "daily_answers" ("day");
