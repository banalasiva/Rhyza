import { db } from "@/lib/db";
import { questionOfTheDay, dayKey } from "@/lib/daily-questions";

// The daily question — read your day's prompt, tap an option, then see how
// everyone else answered. A tiny in-and-out ritual: low effort, a small social
// reward. The question text lives in code; only the choice is stored.

export type DailyQuestionState = {
  day: string;
  text: string;
  options: string[];
  myChoice: number | null; // index into options, or null if not answered yet
  counts: number[]; // votes per option, same order as options
  total: number;
};

// Everyone's day is anchored to UTC so the whole community answers the same
// question and shares one tally — no per-timezone fragmentation of a tiny group.
export async function getDailyQuestionState(
  userId: string,
  now = new Date(),
): Promise<DailyQuestionState> {
  const day = dayKey(now);
  const q = questionOfTheDay(now);

  let rows: { choice: number }[] = [];
  let mine: { choice: number } | null = null;
  try {
    [rows, mine] = await Promise.all([
      db.dailyAnswer.findMany({ where: { day }, select: { choice: true } }),
      db.dailyAnswer.findUnique({
        where: { day_userId: { day, userId } },
        select: { choice: true },
      }),
    ]);
  } catch {
    /* daily_answers not migrated yet — show the question, no tally */
  }

  const counts = q.options.map(() => 0);
  for (const r of rows as { choice: number }[]) {
    if (r.choice >= 0 && r.choice < counts.length) counts[r.choice] += 1;
  }

  return {
    day,
    text: q.text,
    options: q.options,
    myChoice: mine ? mine.choice : null,
    counts,
    total: (rows as { choice: number }[]).length,
  };
}

// Record (or change) this person's answer for today, then return the fresh
// tally so the UI can flip straight to results.
export async function answerDailyQuestion(
  userId: string,
  choice: number,
  now = new Date(),
): Promise<DailyQuestionState> {
  const day = dayKey(now);
  const q = questionOfTheDay(now);
  if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) {
    throw new Error("Invalid choice");
  }

  await db.dailyAnswer.upsert({
    where: { day_userId: { day, userId } },
    create: { day, userId, choice },
    update: { choice },
  });

  return getDailyQuestionState(userId, now);
}
