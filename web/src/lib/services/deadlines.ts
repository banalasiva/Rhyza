import { db } from "@/lib/db";
import { deadlineFollowup } from "@/lib/ai";
import { getOrCreateClaudeUser } from "@/lib/services/contributions";
import { notifySeedAudience } from "@/lib/services/seed-notify";

// ── Rhythm / deadlines ────────────────────────────────────────────────────────
// A group can put a gentle rhythm on a seed so a decision doesn't drift forever:
//   • "paced"    — N days to discuss, then M more days to decide. When each
//                  phase's time arrives, Claude steps into the thread with a
//                  warm, specific nudge toward the next step (converge → bloom).
//   • "peaceful" — no deadline at all, recorded on purpose so everyone sees the
//                  group chose to converge in its own time. No follow-ups.
//
// This is deliberately soft: nothing is force-closed or locked when a deadline
// passes. The only consequence is Claude keeping everyone gently moving — exactly
// the "Claude follows up till Bloom" the group asked for.

const days = (d: number) => d * 24 * 60 * 60 * 1000;

export type DeadlineView = {
  mode: "paced" | "peaceful";
  discussBy: string | null;
  decideBy: string | null;
  setById: string;
  updatedAt: string;
} | null;

// The current rhythm on a seed (or null if none set yet), for the UI.
export async function getDeadline(seedId: string): Promise<DeadlineView> {
  const row = await db.seedDeadline
    .findUnique({ where: { seedId } })
    .catch(() => null);
  if (!row) return null;
  return {
    mode: (row.mode as "paced" | "peaceful") ?? "paced",
    discussBy: row.discussBy ? row.discussBy.toISOString() : null,
    decideBy: row.decideBy ? row.decideBy.toISOString() : null,
    setById: row.setById,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Set (or replace) the rhythm on a seed. Only a steward (canManage) should reach
// here — the API route enforces that. `discussDays`/`decideDays` are counted from
// now; decideBy is discussBy + decideDays so the two phases run back-to-back.
// Changing the rhythm resets the follow-up bookkeeping so the new phases get
// their own fresh nudges.
export async function setDeadline(
  seedId: string,
  userId: string,
  input: { mode: "paced" | "peaceful"; discussDays?: number; decideDays?: number },
  now = new Date(),
): Promise<DeadlineView> {
  let discussBy: Date | null = null;
  let decideBy: Date | null = null;

  if (input.mode === "paced") {
    // Clamp to sane bounds so a fat-fingered "200" can't schedule a nudge a year
    // out. At least a few hours, at most ~30 days per phase.
    const clamp = (d: number | undefined, fallback: number) => {
      const v = Number.isFinite(d) ? Number(d) : fallback;
      return Math.min(Math.max(v, 0.125), 30); // 0.125d = 3h floor
    };
    const dDays = clamp(input.discussDays, 2);
    const kDays = clamp(input.decideDays, 1);
    discussBy = new Date(now.getTime() + days(dDays));
    decideBy = new Date(discussBy.getTime() + days(kDays));
  }

  await db.seedDeadline.upsert({
    where: { seedId },
    create: {
      seedId,
      mode: input.mode,
      discussBy,
      decideBy,
      setById: userId,
      lastFollowupAt: null,
      followupStage: null,
    },
    update: {
      mode: input.mode,
      discussBy,
      decideBy,
      setById: userId,
      // Fresh rhythm → fresh follow-ups.
      lastFollowupAt: null,
      followupStage: null,
    },
  });

  // Keep the seed sorting fresh — a rhythm is a real signal of momentum.
  await db.seed.update({ where: { id: seedId }, data: { lastActivityAt: now } }).catch(() => {});
  return getDeadline(seedId);
}

// Remove the rhythm entirely.
export async function clearDeadline(seedId: string): Promise<void> {
  await db.seedDeadline.delete({ where: { seedId } }).catch(() => {});
}

// Which phase a paced rhythm is in right now.
function phaseOf(discussBy: Date | null, decideBy: Date | null, now: Date): "discuss" | "decide" | "over" {
  if (discussBy && now < discussBy) return "discuss";
  if (decideBy && now < decideBy) return "decide";
  return "over";
}

// What followupStage should be so the cron fires exactly the nudges that are
// still ahead: any phase whose deadline is already in the past counts as
// "delivered" (so it never re-nudges), any phase still in the future stays open.
function followupFor(discussBy: Date | null, decideBy: Date | null, now: Date): string | null {
  if (decideBy && decideBy <= now) return "decide";
  if (discussBy && discussBy <= now) return "discuss";
  return null;
}

// Owner/admin adds time to the CURRENT phase — "we need a bit longer." In the
// discuss phase both deadlines slide by the same amount (the decide window is
// preserved); in the decide phase only decideBy moves; once it's already over,
// this reopens a fresh decide window of `minutes`.
export async function extendDeadline(
  seedId: string,
  minutes: number,
  now = new Date(),
): Promise<DeadlineView> {
  const row = await db.seedDeadline.findUnique({ where: { seedId } }).catch(() => null);
  if (!row || row.mode !== "paced") return getDeadline(seedId);

  const addMs = Math.round(minutes) * 60 * 1000;
  let discussBy = row.discussBy;
  let decideBy = row.decideBy;
  const phase = phaseOf(discussBy, decideBy, now);

  if (phase === "discuss") {
    if (discussBy) discussBy = new Date(discussBy.getTime() + addMs);
    if (decideBy) decideBy = new Date(decideBy.getTime() + addMs);
  } else if (phase === "decide") {
    if (decideBy) decideBy = new Date(decideBy.getTime() + addMs);
  } else {
    // Over → reopen a fresh decide window.
    decideBy = new Date(now.getTime() + addMs);
  }

  await db.seedDeadline.update({
    where: { seedId },
    data: { discussBy, decideBy, followupStage: followupFor(discussBy, decideBy, now), lastFollowupAt: null },
  });
  await db.seed.update({ where: { id: seedId }, data: { lastActivityAt: now } }).catch(() => {});
  return getDeadline(seedId);
}

// Owner/admin "freezes" the current phase — takes the call that discussion (or
// decision time) is over now. Freezing discussion starts the decide countdown
// immediately, keeping the decide window's length; freezing the decision closes
// the timer (it's bloom time). The corresponding Claude nudge is suppressed,
// since a human just made the call.
export async function endPhase(seedId: string, now = new Date()): Promise<DeadlineView> {
  const row = await db.seedDeadline.findUnique({ where: { seedId } }).catch(() => null);
  if (!row || row.mode !== "paced") return getDeadline(seedId);

  let discussBy = row.discussBy;
  let decideBy = row.decideBy;
  const phase = phaseOf(discussBy, decideBy, now);

  if (phase === "discuss") {
    const decideWindow =
      discussBy && decideBy ? Math.max(decideBy.getTime() - discussBy.getTime(), 0) : days(1);
    discussBy = now;
    decideBy = new Date(now.getTime() + decideWindow);
  } else if (phase === "decide") {
    decideBy = now;
  } else {
    return getDeadline(seedId); // already over — nothing to freeze
  }

  await db.seedDeadline.update({
    where: { seedId },
    data: { discussBy, decideBy, followupStage: followupFor(discussBy, decideBy, now), lastFollowupAt: null },
  });
  await db.seed.update({ where: { id: seedId }, data: { lastActivityAt: now } }).catch(() => {});
  return getDeadline(seedId);
}

// ── Follow-up cron ────────────────────────────────────────────────────────────
// Called from the nudge cron. Finds paced seeds whose current phase deadline has
// arrived and where Claude hasn't yet followed up on that phase, and has Claude
// post one warm, specific message moving the group toward the next step. Two
// possible follow-ups over a seed's life: one when the discuss window closes, one
// when the decide window closes. Then it goes quiet — the rest is up to the group.

type ContribRow = {
  authorId: string;
  createdAt: Date;
  content: unknown;
  author: { name: string | null };
};

export async function followUpOnDeadlines(now = new Date()): Promise<{
  scanned: number;
  nudged: number;
}> {
  const budget = Number(process.env.DEADLINE_MAX_PER_RUN || 8);

  let rows: {
    seedId: string;
    discussBy: Date | null;
    decideBy: Date | null;
    followupStage: string | null;
    lastFollowupAt: Date | null;
    seed: { id: string; title: string; createdById: string; bloomId: string | null; deletedAt: Date | null };
  }[] = [];
  try {
    rows = (await db.seedDeadline.findMany({
      where: {
        mode: "paced",
        seed: { deletedAt: null, bloomId: null },
        // At least one phase deadline is in the past.
        OR: [{ discussBy: { lte: now } }, { decideBy: { lte: now } }],
      },
      select: {
        seedId: true,
        discussBy: true,
        decideBy: true,
        followupStage: true,
        lastFollowupAt: true,
        seed: {
          select: { id: true, title: true, createdById: true, bloomId: true, deletedAt: true },
        },
      },
      take: 200,
    })) as typeof rows;
  } catch {
    return { scanned: 0, nudged: 0 };
  }

  const claude = await getOrCreateClaudeUser();
  let nudged = 0;
  let scanned = 0;

  for (const row of rows) {
    if (nudged >= budget) break;

    // Which phase, if any, is now due and hasn't been followed up on yet?
    // Order matters: "decide" supersedes "discuss".
    let phase: "discuss" | "decide" | null = null;
    if (row.decideBy && row.decideBy <= now && row.followupStage !== "decide") {
      phase = "decide";
    } else if (
      row.discussBy &&
      row.discussBy <= now &&
      row.followupStage !== "discuss" &&
      row.followupStage !== "decide"
    ) {
      phase = "discuss";
    }
    // followupStage already guarantees each phase posts at most once, so novelty
    // is settled; nothing more to gate on here.
    if (!phase) continue;

    scanned++;
    const seed = row.seed;

    const contribs = (await db.contribution
      .findMany({
        where: { seedId: seed.id, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { authorId: true, createdAt: true, content: true, author: { select: { name: true } } },
        take: 200,
      })
      .catch(() => [])) as ContribRow[];

    const transcript = contribs
      .slice(-16)
      .map((c) => {
        const text = ((c.content as { text?: string } | null)?.text ?? "").trim();
        return text ? `${c.author.name || "A member"}: ${text.slice(0, 400)}` : "";
      })
      .filter(Boolean)
      .join("\n");

    // Ask Claude for a grounded message; fall back to a plain, kind line so a
    // rhythm the group deliberately set always lands, even with AI off.
    const ai = await deadlineFollowup({ title: seed.title, transcript, phase }).catch(() => null);
    const message =
      ai?.message ??
      (phase === "discuss"
        ? "The time you set to talk this through has arrived 🌱 — where are we leaning? " +
          "If it feels ready, let's start moving toward a decision; if not, it's okay to take a little longer on purpose."
        : "The moment you set to decide is here 🌸 — it looks like there's enough here to choose. " +
          "Shall we agree and bloom it, or is there one thing still worth a little more time?");

    try {
      await db.contribution.create({
        data: { seedId: seed.id, authorId: claude.id, dimension: "debate", content: { text: message } },
      });
      await db.seedDeadline.update({
        where: { seedId: seed.id },
        data: { followupStage: phase, lastFollowupAt: now },
      });
      await db.seed.update({ where: { id: seed.id }, data: { lastActivityAt: now } }).catch(() => {});
      await notifySeedAudience({
        actorId: claude.id,
        seed,
        type: "deadline",
        title:
          phase === "discuss"
            ? `Time to start deciding — “${seed.title.slice(0, 70)}”`
            : `Time to bloom — “${seed.title.slice(0, 70)}”`,
        body: message.slice(0, 140),
      });
      nudged++;
    } catch (err) {
      console.error("followUpOnDeadlines: failed to post", err);
    }
  }

  return { scanned, nudged };
}
