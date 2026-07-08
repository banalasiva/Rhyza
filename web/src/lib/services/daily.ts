import { db } from "@/lib/db";
import { DAILY_MESSAGES, messageOfTheDay, type DailyMessage } from "@/lib/daily-messages";

function pickByDay<T>(arr: T[], now: Date): T {
  const dayNumber = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000,
  );
  const n = arr.length;
  return arr[((dayNumber % n) + n) % n];
}

// Today's message. If the editable DB library has active rows, it drives the
// pick; otherwise (empty, or the table not migrated yet) we fall back to the
// built-in set in lib/daily-messages.ts — so the daily message never fails.
// The quote stands on its own — no action line.
export async function resolveMessageOfTheDay(now = new Date()): Promise<DailyMessage> {
  try {
    const rows = (await db.dailyQuote.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
      select: { text: true, author: true },
    })) as { text: string; author: string | null }[];
    if (rows.length > 0) {
      const r = pickByDay(rows, now);
      return { text: r.text, author: r.author ?? undefined };
    }
  } catch {
    /* table not migrated yet — fall back to the code library */
  }
  return messageOfTheDay(now);
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
      ...(data.text !== undefined ? { text: data.text.trim() } : {}),
      ...(data.author !== undefined ? { author: (data.author ?? "").trim() || null } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });
}

export async function deleteDailyQuote(id: string) {
  await db.dailyQuote.delete({ where: { id } });
  return { deleted: true };
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
