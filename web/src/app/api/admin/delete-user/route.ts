import { handle, ok, ApiError } from "@/lib/api";
import { getViewer } from "@/lib/session";
import { db } from "@/lib/db";
import { deleteAccount } from "@/lib/services/account-deletion";

// POST /api/admin/delete-user  { email }  — owner-only (ADMIN_EMAILS). Anonymises
// the named account and writes a compliance record (actor = the admin's id).
// Fails closed: an unset allowlist denies everyone, and the route hides behind a
// 404 for non-owners so its existence isn't revealed.
export const POST = handle(async (req) => {
  const viewer = await getViewer();
  if (!viewer) throw new ApiError("UNAUTHORIZED", "Sign in first.");
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0 || !allow.includes((viewer.email ?? "").toLowerCase())) {
    throw new ApiError("NOT_FOUND", "Not found");
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) throw new ApiError("BAD_REQUEST", "Email required");

  const target = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!target) throw new ApiError("NOT_FOUND", "No account with that email");
  // The owner deletes their OWN account via the self-serve danger zone (which
  // also signs them out) — refuse it here to avoid a half-state.
  if (target.id === viewer.userId) {
    throw new ApiError("BAD_REQUEST", "Use the self-delete on your own account.");
  }

  await deleteAccount(target.id, viewer.userId);
  return ok({ ok: true });
});
