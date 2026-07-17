import { db } from "@/lib/db";
import { summarizeThreadMemory, type ContribForAI } from "@/lib/ai";

// Per-seed rolling AI memory — the compaction that lets @claude/@chatgpt reply
// with FULL-thread context without resending the whole transcript (which trips
// rate limits and cost). Recent messages go to the model verbatim; everything
// older is folded into a compressed summary kept here. Exactly how a long
// assistant conversation stays coherent for weeks. All best-effort: a missing
// table or failed summary just means the AI falls back to the recent window.

const RECENT_WINDOW = 40; // messages the AI reads verbatim; older ones live in memory
const REFRESH_THRESHOLD = 15; // only re-summarise once this many messages have aged out
const MAX_BATCH = 80; // bound a single summarisation call

// The current rolling summary for a seed (empty string if none / unavailable).
export async function getThreadMemory(seedId: string): Promise<string> {
  const row = await db.seedThreadMemory
    .findUnique({ where: { seedId }, select: { summary: true } })
    .catch(() => null);
  return row?.summary ?? "";
}

// Fold messages that have aged out of the recent window into the rolling
// summary. Safe to call fire-and-forget after each AI reply — it no-ops until
// enough new old-messages have accumulated, and never throws.
export async function refreshThreadMemory(seedId: string, title: string): Promise<void> {
  try {
    const total = await db.contribution.count({ where: { seedId, deletedAt: null } });
    const target = Math.max(0, total - RECENT_WINDOW); // everything except the recent window
    const existing = await db.seedThreadMemory
      .findUnique({ where: { seedId }, select: { summary: true, summarizedCount: true } })
      .catch(() => null);
    const summarizedCount = existing?.summarizedCount ?? 0;
    if (target - summarizedCount < REFRESH_THRESHOLD) return; // not enough aged out yet

    const take = Math.min(MAX_BATCH, target - summarizedCount);
    const rows = await db.contribution.findMany({
      where: { seedId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      skip: summarizedCount,
      take,
      include: { author: { select: { name: true } } },
    });
    if (rows.length === 0) return;
    const batch: ContribForAI[] = rows.map((c) => {
      const content = c.content as { text?: string } | null;
      return {
        dimension: c.dimension,
        author: c.author.name || "A member",
        text: content?.text ?? "",
      };
    });
    const summary = await summarizeThreadMemory(title, existing?.summary ?? "", batch);
    if (!summary) return;
    await db.seedThreadMemory
      .upsert({
        where: { seedId },
        update: { summary, summarizedCount: summarizedCount + rows.length },
        create: { seedId, summary, summarizedCount: rows.length },
      })
      .catch(() => {});
  } catch (err) {
    console.error("refreshThreadMemory failed", err);
  }
}
