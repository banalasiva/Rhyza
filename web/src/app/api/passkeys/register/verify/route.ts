import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { finishPasskeyRegistration } from "@/lib/services/passkeys";

// POST /api/passkeys/register/verify — finish adding a passkey. Body:
// { challengeId, response, label? }.
export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const body = (await req.json().catch(() => ({}))) as {
    challengeId?: string;
    response?: unknown;
    label?: string;
  };
  if (!body.challengeId || !body.response) throw new ApiError("BAD_REQUEST", "Missing passkey response");
  const result = await finishPasskeyRegistration(
    userId,
    body.challengeId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body.response as any,
    body.label,
  );
  if (!result.ok) throw new ApiError("BAD_REQUEST", result.error);
  return ok({ ok: true });
});
