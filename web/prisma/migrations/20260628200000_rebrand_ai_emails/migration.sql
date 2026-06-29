-- Rebrand Rhyza → ThinkThru. The AI participants are keyed by email; rename the
-- existing rows so their past contributions stay attached (instead of the app
-- creating fresh duplicate Claude/ChatGPT users under the new addresses).
--
-- Collision-safe + idempotent: if a row with the NEW email already exists (the
-- running app can create claude@thinkthru.app on its own before this migration
-- is applied), we skip the rename rather than violate users_email_key. Affects
-- 0 rows if the AI users were never created, or were already renamed.
UPDATE "users" SET email = 'claude@thinkthru.app'
  WHERE email = 'claude@rhyza.ai'
    AND NOT EXISTS (SELECT 1 FROM "users" u2 WHERE u2.email = 'claude@thinkthru.app');
UPDATE "users" SET email = 'chatgpt@thinkthru.app'
  WHERE email = 'chatgpt@rhyza.ai'
    AND NOT EXISTS (SELECT 1 FROM "users" u2 WHERE u2.email = 'chatgpt@thinkthru.app');
