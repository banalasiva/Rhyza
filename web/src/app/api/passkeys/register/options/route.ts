import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { enforceRateLimit } from "@/lib/ratelimit";
import { startPasskeyRegistration } from "@/lib/services/passkeys";

// POST /api/passkeys/register/options — begin adding a passkey (must be signed
// in already, via Google/email/an existing passkey). Returns the WebAuthn
// creation options + a challenge id to echo back on verify.
export const POST = handle(async () => {
  const userId = await requireUserId();
  await enforceRateLimit(`pk-reg:${userId}`, 20, 300);
  return ok(await startPasskeyRegistration(userId));
});
