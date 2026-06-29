-- Label each push subscription with its device's user-agent so multi-device
-- delivery can be diagnosed (which device is subscribed / accepting). Idempotent.
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;
