-- The daily "good morning" message library, editable from the admin screen.
CREATE TABLE IF NOT EXISTS "daily_quotes" (
    "id"         UUID NOT NULL,
    "text"       TEXT NOT NULL,
    "author"     TEXT,
    "active"     BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_quotes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "daily_quotes_active_idx" ON "daily_quotes" ("active");
