import { handle, ok, ApiError } from "@/lib/api";
import { getViewer } from "@/lib/session";
import { firebaseAdminSelfTest } from "@/lib/firebase-admin";

// GET /api/admin/firebase-check — owner-only sanity check for the Firebase env
// vars, so the setup can be validated without pasting any secret anywhere. It
// reports only the SHAPE of each value (present? right prefix? stray quotes?)
// and whether the private key actually signs — NEVER the values themselves.
// Same fail-closed gating as /api/admin/migrate.
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
  const projectIdPublic = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "";
  const projectId = process.env.FIREBASE_PROJECT_ID ?? "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";
  const key = process.env.FIREBASE_PRIVATE_KEY ?? "";
  const bareKey = key.replace(/^["']/, "").replace(/["']$/, "");

  // Only booleans / lengths — no secret material is ever returned.
  const report = {
    client: {
      apiKey: { present: !!apiKey, looksValid: apiKey.startsWith("AIza"), hasQuotes: quoted(apiKey) },
      authDomain: {
        present: !!authDomain,
        looksValid: authDomain.endsWith(".firebaseapp.com"),
        hasQuotes: quoted(authDomain),
      },
      projectId: { present: !!projectIdPublic, hasQuotes: quoted(projectIdPublic) },
      appId: { present: !!appId, hasQuotes: quoted(appId) },
    },
    admin: {
      projectId: { present: !!projectId, hasQuotes: quoted(projectId) },
      clientEmail: {
        present: !!clientEmail,
        looksValid: clientEmail.endsWith("gserviceaccount.com"),
        hasQuotes: quoted(clientEmail),
      },
      privateKey: {
        present: !!key,
        startsWithBegin: bareKey.startsWith("-----BEGIN PRIVATE KEY-----"),
        containsEnd: bareKey.includes("-----END PRIVATE KEY-----"),
        hasSurroundingQuotes: quoted(key),
        hasEscapedNewlines: key.includes("\\n"),
        hasRealNewlines: key.includes("\n"),
        length: key.length,
      },
    },
    projectIdMatch: !!projectId && projectId === projectIdPublic,
  };

  // The definitive check: does the private key actually parse and sign?
  const signs = await firebaseAdminSelfTest();

  return ok({ report, signs });
});
