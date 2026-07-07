import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { listReports, actOnReport } from "@/lib/services/reports";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/admin/reports — the moderation queue (app owner only).
export const GET = handle(async () => {
  await requireAdmin();
  return ok({ reports: await listReports("open") });
});

const actSchema = z.object({
  reportId: z.string().uuid(),
  action: z.enum(["remove", "dismiss"]),
});

// POST /api/admin/reports — act on one report (app owner only).
export const POST = handle(async (req) => {
  await requireAdmin();
  const { reportId, action } = actSchema.parse(await req.json());
  return ok(await actOnReport(reportId, action));
});
