-- Heartbeat per cron slot so /admin can confirm the scheduler actually fired.
CREATE TABLE IF NOT EXISTS "cron_runs" (
    "name"        TEXT NOT NULL,
    "last_run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detail"      TEXT,
    CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("name")
);
