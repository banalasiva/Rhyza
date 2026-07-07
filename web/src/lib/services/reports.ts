import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { deserializeMentions } from "@/lib/mentions";

// The moderation queue behind /admin/reports. Reads the SeedReport rows people
// file with the Report button, and lets the app owner act on each: remove the
// flagged content, or dismiss the report. Reactive-only by design — nobody
// browses private content; we only ever surface what was actually reported.

export type ReportRow = {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  reporter: string;
  seedId: string;
  seedTitle: string;
  seedVisibility: string;
  contributionId: string | null;
  contributionText: string | null;
  contributionAuthor: string | null;
  contributionDeleted: boolean;
};

export async function listReports(status: "open" | "reviewed" | "dismissed" | "all" = "open"): Promise<ReportRow[]> {
  const reports = await db.seedReport.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reporter: { select: { name: true } },
      seed: { select: { title: true, visibility: true } },
    },
  });

  // Fetch the flagged contributions in one batch.
  const contribIds = reports.map((r) => r.contributionId).filter((x): x is string => !!x);
  const contribs = contribIds.length
    ? await db.contribution.findMany({
        where: { id: { in: contribIds } },
        select: { id: true, content: true, deletedAt: true, author: { select: { name: true } } },
      })
    : [];
  const byId = new Map(contribs.map((c) => [c.id, c]));

  return reports.map((r) => {
    const c = r.contributionId ? byId.get(r.contributionId) : undefined;
    const text = c ? (c.content as { text?: string } | null)?.text ?? "" : null;
    return {
      id: r.id,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reporter: r.reporter?.name ?? "Someone",
      seedId: r.seedId,
      seedTitle: r.seed?.title ?? "(deleted seed)",
      seedVisibility: r.seed?.visibility ?? "private",
      contributionId: r.contributionId,
      contributionText: text != null ? deserializeMentions(text) : null,
      contributionAuthor: c?.author?.name ?? null,
      contributionDeleted: !!c?.deletedAt,
    };
  });
}

export async function countOpenReports(): Promise<number> {
  return db.seedReport.count({ where: { status: "open" } });
}

// Act on a report. `remove` soft-deletes the flagged content (the specific
// contribution, or the whole seed if the report is seed-level); `dismiss` just
// closes the report with no action. Both mark the report resolved.
export async function actOnReport(reportId: string, action: "remove" | "dismiss"): Promise<{ ok: true }> {
  const report = await db.seedReport.findUnique({ where: { id: reportId } });
  if (!report) throw new ApiError("NOT_FOUND", "Report not found");

  if (action === "remove") {
    if (report.contributionId) {
      await db.contribution.update({
        where: { id: report.contributionId },
        data: { deletedAt: new Date() },
      });
    } else {
      // Seed-level report → remove the whole seed.
      await db.seed.update({ where: { id: report.seedId }, data: { deletedAt: new Date() } });
    }
    await db.seedReport.update({ where: { id: reportId }, data: { status: "reviewed" } });
  } else {
    await db.seedReport.update({ where: { id: reportId }, data: { status: "dismissed" } });
  }
  return { ok: true };
}
