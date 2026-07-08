import { db } from "@/lib/db";
import { DAILY_MESSAGES, messageOfTheDay, type DailyMessage } from "@/lib/daily-messages";
import { craftDailyAction } from "@/lib/ai";

function pickByDay<T>(arr: T[], now: Date): T {
  const dayNumber = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000,
  );
  const n = arr.length;
  return arr[((dayNumber % n) + n) % n];
}

// Per-quote action cache, so we craft the "do this today" nudge at most once per
// quote per warm instance (and, for DB quotes, persist it on the row too).
const actionCache = new Map<string, string>();

// The "do this today" nudge for a quote — Claude-crafted, cached. For a DB quote
// it's stored on the row (id given) so it's generated once ever; for the code
// library it's kept in memory. Best-effort: "" on any failure.
async function actionFor(text: string, author?: string, id?: string): Promise<string> {
  const key = id ?? text;
  const cached = actionCache.get(key);
  if (cached !== undefined) return cached;

  const crafted = await craftDailyAction(text, author);
  actionCache.set(key, crafted);
  if (id && crafted) {
    db.dailyQuote.update({ where: { id }, data: { action: crafted } }).catch(() => {});
  }
  return crafted;
}

// Today's message. If the editable DB library has active rows, it drives the
// pick; otherwise (empty, or the table not migrated yet) we fall back to the
// built-in set in lib/daily-messages.ts — so the daily message never fails.
// Each message ends with a small, Claude-crafted action for the day.
export async function resolveMessageOfTheDay(now = new Date()): Promise<DailyMessage> {
  try {
    const rows = (await db.dailyQuote.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, text: true, author: true, action: true },
    })) as { id: string; text: string; author: string | null; action: string | null }[];
    if (rows.length > 0) {
      const r = pickByDay(rows, now);
      const author = r.author ?? undefined;
      const action = r.action ?? (await actionFor(r.text, author, r.id));
      return { text: r.text, author, action: action || undefined };
    }
  } catch {
    /* table not migrated yet — fall back to the code library */
  }
  const m = messageOfTheDay(now);
  const action = await actionFor(m.text, m.author);
  return { ...m, action: action || undefined };
}

// ── Admin curation ──
export async function listDailyQuotes() {
  return db.dailyQuote.findMany({ orderBy: { createdAt: "asc" } });
}

export async function addDailyQuote(text: string, author?: string | null) {
  const t = text.trim();
  if (!t) throw new Error("Message text is required");
  return db.dailyQuote.create({ data: { text: t, author: author?.trim() || null } });
}

export async function updateDailyQuote(
  id: string,
  data: { text?: string; author?: string | null; active?: boolean },
) {
  return db.dailyQuote.update({
    where: { id },
    data: {
      // Changing the text invalidates the crafted action — null it so a fresh
      // one is generated on next resolve.
      ...(data.text !== undefined ? { text: data.text.trim(), action: null } : {}),
      ...(data.author !== undefined ? { author: (data.author ?? "").trim() || null } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });
}

export async function deleteDailyQuote(id: string) {
  await db.dailyQuote.delete({ where: { id } });
  return { deleted: true };
}

// Clear every stored action so they're re-crafted (with the current prompt) on
// next resolve. Use after tuning how actions read.
export async function regenerateDailyActions() {
  actionCache.clear();
  const r = await db.dailyQuote.updateMany({ data: { action: null } }).catch(() => ({ count: 0 }));
  return { cleared: r.count };
}

// One-time seed: copy the built-in 330 into the editable table so the owner
// starts their yearly curation from the full set. No-op if rows already exist.
export async function importDefaultQuotes() {
  const count = await db.dailyQuote.count();
  if (count > 0) return { imported: 0, total: count };
  await db.dailyQuote.createMany({
    data: DAILY_MESSAGES.map((m) => ({ text: m.text, author: m.author ?? null })),
  });
  return { imported: DAILY_MESSAGES.length, total: DAILY_MESSAGES.length };
}
