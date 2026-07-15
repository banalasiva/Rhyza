import { handle, ok, ApiError } from "@/lib/api";
import { getViewer } from "@/lib/session";
import { firebaseVerifySelfTest } from "@/lib/firebase-verify";

// GET /api/admin/firebase-check — owner-only sanity check for the Firebase env
// vars, so the setup can be validated without pasting any secret anywhere. It
// reports only the SHAPE of each value (present? right prefix? stray quotes?)
// and whether the server can reach Google's public keys — NEVER the values.
// Same fail-closed gating as /api/admin/migrate.
//
// Note: verification is done with jose against Google's PUBLIC keys, so NO
// service account is needed — phone sign-in works with just the client config.
export const maxDuration = 30;

const quoted = (s: string) => /^["']|["']$/.test(s);

export const GET = handle(async () => {
  const viewer = await getViewer();
  if (!viewer) throw new ApiError("UNAUTHORIZED", "Sign in first.");
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0)
    throw new ApiError("FORBIDDEN", "Disabled. Set ADMIN_EMAILS to enable it.");
  if (!allow.includes((viewer.email ?? "").toLowerCase()))
    throw new ApiError("FORBIDDEN", "Not an admin on this deployment.");

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "";

  // Only booleans — no secret material is ever returned. Service-account vars are
  // intentionally NOT checked here: they're no longer used.
  const report = {
    apiKey: { present: !!apiKey, looksValid: apiKey.startsWith("AIza"), hasQuotes: quoted(apiKey) },
    authDomain: {
      present: !!authDomain,
      looksValid: authDomain.endsWith(".firebaseapp.com"),
      hasQuotes: quoted(authDomain),
    },
    projectId: { present: !!projectId, hasQuotes: quoted(projectId) },
    appId: { present: !!appId, hasQuotes: quoted(appId) },
  };

  // Confirms the project id is set and Google's public keys are reachable — i.e.
  // a real token verify will succeed.
  const verify = await firebaseVerifySelfTest();

  return ok({ report, verify });
});
