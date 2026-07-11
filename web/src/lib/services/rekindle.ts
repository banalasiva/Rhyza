import { db } from "@/lib/db";
import { aiConfigured, resparkThread } from "@/lib/ai";
import { getOrCreateClaudeUser } from "@/lib/services/contributions";
import { notifySeedAudience } from "@/lib/services/seed-notify";

// "Re-kindle" — Claude watches for good conversations that have gone quiet and,
// when there's a real reason, steps back INTO the thread with a short, warm
// re-opener of its own. Not a private nudge to one person — a real message in
// the room that everyone sees, that gives the group something specific to reply
// to. The judgment of whether a quiet thread is worth reviving (and what to say)
// is Claude's, grounded in the actual messages — see resparkThread in ai.ts.
//
// Guardrails, because over-posting destroys trust fast:
//   • Only threads that are live (not bloomed/deleted), have real human
//     discussion (≥2 human messages), and have gone quiet for a while (but not
//     ancient).
//   • Per-seed cooldown: Claude never re-opens the same thread twice within
//     ~REKINDLE_SEED_COOLDOWN_DAYS. And if Claude already posted the last word
//     and nobody replied, it stays quiet — a re-opener no one answered is a sign
//     to stop, not to try again.
//   • A hard budget per run, so a busy DB can never turn into a spark storm.

const AI_NAMES = ["Claude", "ChatGPT"];

const hours = (h: number) => h * 60 * 60 * 1000;
const days = (d: number) => d * 24 * 60 * 60 * 1000;

type ContribRow = {
  authorId: string;
  createdAt: Date;
  content: unknown;
  author: { id: string; name: string | null };
};

export async function rekindleStallingThreads(now = new Date()): Promise<{
  scanned: number;
  sparked: number;
}> {
  if (!aiConfigured()) return { scanned: 0, sparked: 0 };

  const quietMin = Number(process.env.REKINDLE_QUIET_HOURS || 18);
  const quietMaxDays = Number(process.env.REKINDLE_QUIET_MAX_DAYS || 7);
  const budget = Number(process.env.REKINDLE_MAX_PER_RUN || 5);
  const perSeedCooldownD = Number(process.env.REKINDLE_SEED_COOLDOWN_DAYS || 5);

  const quietBefore = new Date(now.getTime() - hours(quietMin));
  const notOlderThan = new Date(now.getTime() - days(quietMaxDays));
  const seedCooldownStart = new Date(now.getTime() - days(perSeedCooldownD));

  // Candidate threads: live (not bloomed/deleted), went quiet in the window.
  let seeds: { id: string; title: string; createdById: string }[] = [];
  try {
    seeds = (await db.seed.findMany({
      where: {
        deletedAt: null,
        bloomId: null,
        lastActivityAt: { lte: quietBefore, gte: notOlderThan },
      },
      orderBy: { lastActivityAt: "desc" },
      select: { id: true, title: true, createdById: true },
      take: 40,
    })) as { id: string; title: string; createdById: string }[];
  } catch {
    return { scanned: 0, sparked: 0 };
  }

  const claude = await getOrCreateClaudeUser();

  let sparked = 0;
  let scanned = 0;

  for (const seed of seeds) {
    if (sparked >= budget) break;
    scanned++;

    // The thread's recent messages + who spoke.
    const contribs = (await db.contribution
      .findMany({
        where: { seedId: seed.id, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          authorId: true,
          createdAt: true,
          content: true,
          author: { select: { id: true, name: true } },
        },
        take: 200,
      })
      .catch(() => [])) as ContribRow[];
    if (contribs.length === 0) continue;

    // Need a real human conversation to be worth reviving.
    const humanMsgs = contribs.filter((c) => !AI_NAMES.includes(c.author.name ?? ""));
    if (humanMsgs.length < 2) continue;

    // Per-seed cooldown: if Claude already re-opened (or replied to) this thread
    // within the cooldown window, leave it be. In particular, if Claude posted
    // the LAST message and no human answered, a second re-opener would just be
    // Claude talking to itself — so we skip.
    const lastMsg = contribs[contribs.length - 1];
    if (lastMsg.authorId === claude.id) continue;
    const claudeRecently = contribs.some(
      (c) => c.authorId === claude.id && c.createdAt >= seedCooldownStart,
    );
    if (claudeRecently) continue;

    // Build the transcript from the last ~14 messages for Claude to read.
    const transcript = contribs
      .slice(-14)
      .map((c) => {
        const text = ((c.content as { text?: string } | null)?.text ?? "").trim();
        return text ? `${c.author.name || "A member"}: ${text.slice(0, 400)}` : "";
      })
      .filter(Boolean)
      .join("\n");
    if (!transcript) continue;

    // Claude decides whether this quiet thread is worth reviving, and if so
    // writes the re-opener in its own voice.
    const spark = await resparkThread({ title: seed.title, transcript });
    if (!spark) continue;

    try {
      const contribution = await db.contribution.create({
        data: {
          seedId: seed.id,
          authorId: claude.id,
          dimension: "debate",
          content: { text: spark.message },
        },
        select: { id: true },
      });

      // The thread just moved — keep it fresh so it sorts back up, and tell the
      // seed's people Claude re-opened it so they come back and reply.
      await db.seed
        .update({ where: { id: seed.id }, data: { lastActivityAt: now } })
        .catch(() => {});
      await notifySeedAudience({
        actorId: claude.id,
        seed,
        type: "rekindle",
        title: `Claude re-opened “${seed.title.slice(0, 80)}”`,
        body: spark.message.slice(0, 140),
        // Anchor push straight to the new message.
      });

      void contribution;
      sparked++;
    } catch (err) {
      console.error("rekindle: failed to spark", err);
    }
  }

  return { scanned, sparked };
}
