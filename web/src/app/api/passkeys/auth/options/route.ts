import { handle, ok } from "@/lib/api";
import { enforceRateLimit } from "@/lib/ratelimit";
import { startPasskeyLogin } from "@/lib/services/passkeys";

// POST /api/passkeys/auth/options — begin a usernameless passkey login. Public
// (no session yet). Returns request options + a challenge id; the actual verify
// happens in the Auth.js "passkey" Credentials provider so it mints a session.
export const POST = handle(async (req) => {
  // Public + unauthenticated, so cap by client IP — stops a script minting
  // endless challenges (storage churn / probing) without a session.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  await enforceRateLimit(`pk-auth:${ip}`, 20, 300);
  return ok(await startPasskeyLogin());
});
