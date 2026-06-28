-- Let a notification point at the exact contribution that triggered it, so a
-- click can scroll straight to that message.
ALTER TABLE "notifications" ADD COLUMN "anchor_id" UUID;
