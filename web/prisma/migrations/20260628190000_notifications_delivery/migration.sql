-- Notification delivery: external channels (email + web push), per-user prefs,
-- and per-notification delivery timestamps so the daily digest never repeats
-- what already went out instantly.

-- Per-notification delivery markers.
ALTER TABLE "notifications" ADD COLUMN "emailed_at" TIMESTAMP(3);
ALTER TABLE "notifications" ADD COLUMN "pushed_at" TIMESTAMP(3);

-- Per-user notification preferences + one-click unsubscribe token.
ALTER TABLE "users" ADD COLUMN "email_notify" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "push_notify" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "digest_notify" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "unsub_token" TEXT;
CREATE UNIQUE INDEX "users_unsub_token_key" ON "users"("unsub_token");

-- Web Push subscriptions (one person may have several devices).
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
