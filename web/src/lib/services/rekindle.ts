import { db } from "@/lib/db";
import { deliver } from "@/lib/services/notify";
import { aiConfigured, pickRekindleNudge } from "@/lib/ai";
import { pushConfigured } from "@/lib/push";

// "Re-kindle" — Claude watches for good conversations that have gone quiet and,
// when there's a real reason, draws the right person back with a specific, warm
// nudge. This is the retention loop that doesn't feel like spam: the judgment of
// whether a thread is worth reviving (and who's best to revive it) is Claude's,
// grounded in the actual messages — see pickRekindleNudge in ai.ts.
//
// Guardrails, because over-nudging destroys trust fast:
//   • Only threads that are live, have real human discussion, and have gone quiet
//     for a while (but not ancient).
//   • Only nudge people already involved who've fallen silent — never a cold ping.
//   • Per-person cooldown (no one gets re-kindled more than once every ~20h) and
//     per-(person, thread) cooldown (~5 days) via the notifications we write.
//   • A hard budget per run, so a busy DB can never turn into a nudge storm.

const NUDGE_TYPE = "rekindle";
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
  nudged: number;
}> {
  if (!aiConfigured() || !pushConfigured()) return { scanned: 0, nudged: 0 };

  const quietMin = Number(process.env.REKINDLE_QUIET_HOURS || 18);
  const quietMaxDays = Number(process.env.REKINDLE_QUIET_MAX_DAYS || 7);
  const budget = Number(process.env.REKINDLE_MAX_PER_RUN || 5);
  const perUserCooldownH = Number(process.env.REKINDLE_USER_COOLDOWN_HOURS || 20);
  const perSeedCooldownD = Number(process.env.REKINDLE_SEED_COOLDOWN_DAYS || 5);

  const quietBefore = new Date(now.getTime() - hours(quietMin));
  const notOlderThan = new Date(now.getTime() - days(quietMaxDays));

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
    return { scanned: 0, nudged: 0 };
  }

  // Who's been re-kindled recently — global per-user cooldown, so nobody gets
  // pulled back too often across all their threads.
  const recentlyNudged = new Set<string>();
  try {
    const rows = await db.notification.findMany({
      where: { type: NUDGE_TYPE, createdAt: { gte: new Date(now.getTime() - hours(perUserCooldownH)) } },
      select: { recipientId: true },
    });
    for (const r of rows as { recipientId: string }[]) recentlyNudged.add(r.recipientId);
  } catch {
    /* best-effort */
  }

  let nudged = 0;
  let scanned = 0;

  for (const seed of seeds) {
    if (nudged >= budget) break;
    scanned++;

    // The thread's recent messages + who's involved.
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

    // Need a real human conversation to be worth reviving.
    const humanMsgs = contribs.filter((c) => !AI_NAMES.includes(c.author.name ?? ""));
    if (humanMsgs.length < 2) continue;

    // Members are also "involved" even if they haven't spoken yet.
    const members = (await db.seedMember
      .findMany({ where: { seedId: seed.id }, select: { userId: true } })
      .catch(() => [])) as { userId: string }[];

    // Everyone recently active in this thread (spoke in the last quietMin hours)
    // is NOT a candidate — they're already engaged.
    const activeCutoff = new Date(now.getTime() - hours(quietMin));
    const recentlyActive = new Set(
      contribs.filter((c) => c.createdAt >= activeCutoff).map((c) => c.authorId),
    );

    // Involved people = participants + members, minus AI bots.
    const involved = new Map<string, string | null>();
    for (const c of humanMsgs) involved.set(c.authorId, c.author.name);
    for (const m of members) if (!involved.has(m.userId)) involved.set(m.userId, null);

    const candidateIds = [...involved.keys()].filter((id) => !recentlyActive.has(id));
    if (candidateIds.length === 0) continue;

    // Apply cooldowns: skip anyone re-kindled anywhere recently, or already
    // re-kindled about THIS seed within the seed cooldown.
    const seedCooldownRows = (await db.notification
      .findMany({
        where: {
          type: NUDGE_TYPE,
          entityId: seed.id,
          recipientId: { in: candidateIds },
          createdAt: { gte: new Date(now.getTime() - days(perSeedCooldownD)) },
        },
        select: { recipientId: true },
      })
      .catch(() => [])) as { recipientId: string }[];
    const seedCooled = new Set(seedCooldownRows.map((r) => r.recipientId));

    let eligibleIds = candidateIds.filter((id) => !recentlyNudged.has(id) && !seedCooled.has(id));
    if (eligibleIds.length === 0) continue;

    // Respect notification preferences — only people who want push.
    const wantPush = (await db.user
      .findMany({
        where: { id: { in: eligibleIds }, pushNotify: true, deletedAt: null },
        select: { id: true, name: true },
      })
      .catch(() => [])) as { id: string; name: string | null }[];
    if (wantPush.length === 0) continue;

    const candidates = wantPush.map((u) => ({
      id: u.id,
      firstName: (u.name || "there").trim().split(/\s+/)[0],
    }));

    // Build the transcript from the last ~10 messages for Claude to read.
    const transcript = contribs
      .slice(-10)
      .map((c) => {
        const text = ((c.content as { text?: string } | null)?.text ?? "").trim();
        return text ? `${c.author.name || "A member"}: ${text.slice(0, 400)}` : "";
      })
      .filter(Boolean)
      .join("\n");
    if (!transcript) continue;

    const pick = await pickRekindleNudge({
      title: seed.title,
      transcript,
      candidates: candidates.map((c) => ({ firstName: c.firstName })),
    });
    if (!pick) continue;

    const target = candidates[pick.candidateIndex];
    if (!target) continue;

    // Write the notification and push it. Title carries the thread; body is
    // Claude's specific reason.
    try {
      const note = await db.notification.create({
        data: {
          recipientId: target.id,
          type: NUDGE_TYPE,
          title: `“${seed.title.slice(0, 80)}”`,
          body: pick.line,
          entityType: "seed",
          entityId: seed.id,
          // Self-delivered below — stamp nudgedAt so the evening summary slot
          // never rolls this same nudge into a second push.
          nudgedAt: now,
        },
        select: { id: true },
      });
      await deliver([
        {
          notificationId: note.id,
          recipientId: target.id,
          type: NUDGE_TYPE,
          push: { title: `“${seed.title.slice(0, 80)}”`, body: pick.line },
          link: `/seeds/${seed.id}`,
        },
      ]);
      recentlyNudged.add(target.id); // don't double-nudge this person this run
      nudged++;
    } catch (err) {
      console.error("rekindle: failed to nudge", err);
    }
  }

  return { scanned, nudged };
}
