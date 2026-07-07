import { ApiError } from "@/lib/api";
import { getViewer } from "@/lib/session";

// Is this email one of the app owner(s) (the platform operators, ADMIN_EMAILS)?
// The superadmin tier above garden/seed owners — can moderate anywhere.
export function isAppOwner(email?: string | null): boolean {
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!email && allow.length > 0 && allow.includes(email.toLowerCase());
}

// Owner check for admin-only endpoints. Gated to ADMIN_EMAILS (fails closed):
// no list set, or a non-listed viewer, both throw. Returns the viewer so
// callers can use it.
export async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer) throw new ApiError("UNAUTHORIZED", "Sign in first.");
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0 || !allow.includes((viewer.email ?? "").toLowerCase())) {
    throw new ApiError("FORBIDDEN", "Not an admin on this deployment.");
  }
  return viewer;
}
