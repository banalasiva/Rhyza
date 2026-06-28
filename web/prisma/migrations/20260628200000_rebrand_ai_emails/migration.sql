-- Rebrand Rhyza → ThinkThru. The AI participants are keyed by email; rename the
-- existing rows so their past contributions stay attached (instead of the app
-- creating fresh duplicate Claude/ChatGPT users under the new addresses).
-- Idempotent: affects 0 rows if the AI users were never created.
UPDATE "users" SET email = 'claude@thinkthru.app'  WHERE email = 'claude@rhyza.ai';
UPDATE "users" SET email = 'chatgpt@thinkthru.app' WHERE email = 'chatgpt@rhyza.ai';
