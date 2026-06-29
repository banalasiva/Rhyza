-- Let a notification point at the exact contribution that triggered it, so a
-- click can scroll straight to that message. IF NOT EXISTS so it's safe to run
-- via either `prisma migrate deploy` or the /api/admin/migrate endpoint.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "anchor_id" UUID;