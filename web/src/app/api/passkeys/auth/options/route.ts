import { handle, ok } from "@/lib/api";
import { startPasskeyLogin } from "@/lib/services/passkeys";

// POST /api/passkeys/auth/options — begin a usernameless passkey login. Public
// (no session yet). Returns request options + a challenge id; the actual verify
// happens in the Auth.js "passkey" Credentials provider so it mints a session.
export const POST = handle(async () => {
  return ok(await startPasskeyLogin());
});
