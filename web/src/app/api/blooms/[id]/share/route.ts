import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getOrCreateShareSettings, updateShareSettings } from "@/lib/services/calibration";

// POST /api/blooms/:id/share — mint (or fetch) the calibration link + its access
// settings (anyone-with-the-link vs restricted to specific emails).
export const POST = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const settings = await getOrCreateShareSettings(userId, ctx.params.id);
  if (!settings) throw new ApiError("NOT_FOUND", "Bloom not found");
  return ok(settings);
});

// PATCH /api/blooms/:id/share — update who can open the link.
export const PATCH = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = (await req.json().catch(() => ({}))) as {
    access?: string;
    allowedEmails?: unknown;
  };
  const access =
    body.access === "restricted" ? "restricted" : body.access === "off" ? "off" : "anyone";
  const allowedEmails = Array.isArray(body.allowedEmails)
    ? body.allowedEmails.map((e) => String(e))
    : [];
  const settings = await updateShareSettings(userId, ctx.params.id, { access, allowedEmails });
  if (!settings) throw new ApiError("NOT_FOUND", "Bloom not found");
  return ok(settings);
});
