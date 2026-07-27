import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { aiHealthCheck } from "@/lib/ai";

export const dynamic = "force-dynamic";

// GET /api/admin/ai-health — ping Claude + ChatGPT with a tiny real completion
// and report the exact provider status/error. Admin-only (spends a token or two).
export const GET = handle(async () => {
  await requireAdmin();
  return ok(await aiHealthCheck());
});
