import { db } from "@/lib/db";
import { requireSeedAccess } from "@/lib/authz";
import { deliver } from "@/lib/services/notify";
import { displayName } from "@/lib/display-name";

// The day-21 reckoning — the fourth virtue, JUDGEMENT. Weeks after a decision
// blooms, the people who made it look back TOGETHER and judge how it actually
// turned out. Unlike the private, revisitable reflection (a personal mirror),
// the reckoning is a COLLECTIVE, scheduled ritual: everyone's verdict is shared
// to the group by design, so the whole room sees how the call landed. All reads
// and writes are best-effort against standalone tables, so a missing table (or
// an un-migrated DB) can never break the bloom page.

export const VERDICTS = ["well", "mixed", "regret"] as const;
export type Verdict = (typeof VERDICTS)[number];
const isVerdict = (v: unknown): v is Verdict => VERDICTS.includes(v as Verdict);

// How long after a bloom the reckoning opens. 21 days by default; overridable so
// the moment can be tuned (or shortened for a demo) without a code change.
export const RECKON_DAYS = (() => {
  const n = Number(process.env.RECKON_DAYS);
  return Number.isFinite(n) && n >= 0 ? n : 21;
})();

const DAY_MS = 24 * 60 * 60 * 1000;
const clampNote = (s: unknown): string | null => {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t ? t.slice(0, 280) : null;
};

export type ReckoningVoice = { name: string; verdict: Verdict; note: string | null };
export type Reckoning = {
  opened: boolean; // has the reckoning been opened (by cron or a participant)?
  openedAt: string | null;
  dueAt: string; // when the day-21 nudge is scheduled for
  due: boolean; // is it past due (i.e. old enough to reckon now)?
  canReckon: boolean; // may the viewer cast a verdict?
  myVerdict: Verdict | null;
  myNote: string | null;
  tally: { well: number; mixed: number; regret: number };
  total: number;
  voices: ReckoningVoice[]; // everyone's shared verdict (incl. the viewer)
};

function emptyTally() {
  return { well: 0, mixed: 0, regret: 0 };
}

// The viewer's view of a bloom's reckoning. Never throws for a missing table:
// the whole thing degrades to "not open, nothing yet" so the bloom page is safe.
export async function getReckoning(userId: string, bloomId: string): Promise<Reckoning | null> {
  const bloom = await db.bloom
    .findUnique({ where: { id: bloomId }, select: { id: true, seedId: true, bloomedAt: true } })
    .catch(() => null);
  if (!bloom) return null;

  // Access gate — same rule as the rest of the bloom page. If the viewer can't
  // open the bloom, they can't reckon; requireSeedAccess throws, which the bloom
  // page already handles, so let it propagate is wrong here — we're a sub-read.
  let canReckon = false;
  try {
    await requireSeedAccess(userId, bloom.seedId);
    canReckon = true;
  } catch {
    canReckon = false;
  }

  const dueAt = new Date(bloom.bloomedAt.getTime() + RECKON_DAYS * DAY_MS);
  const due = Date.now() >= dueAt.getTime();

  const [openRow, rows] = await Promise.all([
    db.bloomReckoningOpen
      .findUnique({ where: { bloomId }, select: { openedAt: true } })
      .catch(() => null),
    db.bloomReckoning
      .findMany({ where: { bloomId }, orderBy: { createdAt: "asc" }, take: 200 })
      .catch(() => [] as Awaited<ReturnType<typeof db.bloomReckoning.findMany>>),
  ]);

  const tally = emptyTally();
  let myVerdict: Verdict | null = null;
  let myNote: string | null = null;
  for (const r of rows) {
    if (isVerdict(r.verdict)) tally[r.verdict]++;
    if (r.userId === userId) {
      myVerdict = isVerdict(r.verdict) ? r.verdict : null;
      myNote = r.note ?? null;
    }
  }

  // Names for the shared voices (the tables carry no FK to users, by design).
  const userIds = rows.map((r) => r.userId);
  const users = userIds.length
    ? await db.user
        .findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
        .catch(() => [] as { id: string; name: string | null; email: string | null }[])
    : [];
  const nameById = new Map(users.map((u) => [u.id, displayName(u)]));

  const voices: ReckoningVoice[] = rows
    .filter((r) => isVerdict(r.verdict))
    .map((r) => ({
      name: nameById.get(r.userId) ?? "A member",
      verdict: r.verdict as Verdict,
      note: r.note?.trim() || null,
    }));

  return {
    opened: !!openRow,
    openedAt: openRow?.openedAt ? openRow.openedAt.toISOString() : null,
    dueAt: dueAt.toISOString(),
    due,
    canReckon,
    myVerdict,
    myNote,
    tally,
    total: voices.length,
    voices,
  };
}

// Mark a bloom's reckoning "opened" (idempotent). Presence of the row is what
// makes the card go live before the natural day-21 date — used both by the cron
// (openedById null) and by a participant choosing to look back early.
async function markOpened(bloomId: string, seedId: string, openedById: string | null) {
  await db.bloomReckoningOpen
    .upsert({
      where: { bloomId },
      create: { bloomId, seedId, openedById },
      update: {}, // never overwrite the original open
    })
    .catch(() => {});
}

// A participant opens the reckoning early ("look back now"), so the group doesn't
// have to wait for the day-21 nudge. Opening also notifies the rest of the room.
export async function openReckoning(userId: string, bloomId: string): Promise<Reckoning | null> {
  const bloom = await db.bloom
    .findUnique({ where: { id: bloomId }, select: { id: true, seedId: true, title: true } })
    .catch(() => null);
  if (!bloom) return null;
  await requireSeedAccess(userId, bloom.seedId);

  const already = await db.bloomReckoningOpen
    .findUnique({ where: { bloomId }, select: { bloomId: true } })
    .catch(() => null);
  await markOpened(bloomId, bloom.seedId, userId);
  // Only fan out the invite the first time it's opened.
  if (!already) {
    await notifyReckoning(bloomId, bloom.seedId, bloom.title, userId).catch(() => {});
  }
  return getReckoning(userId, bloomId);
}

// Cast (or change) the viewer's verdict on how the decision turned out. Opening
// happens implicitly, so an early caster brings the reckoning to life for all.
export async function castReckoning(
  userId: string,
  bloomId: string,
  verdict: string,
  note: unknown,
): Promise<Reckoning | null> {
  if (!isVerdict(verdict)) return getReckoning(userId, bloomId);
  const bloom = await db.bloom
    .findUnique({ where: { id: bloomId }, select: { id: true, seedId: true } })
    .catch(() => null);
  if (!bloom) return null;
  await requireSeedAccess(userId, bloom.seedId);

  await markOpened(bloomId, bloom.seedId, userId);
  await db.bloomReckoning
    .upsert({
      where: { bloomId_userId: { bloomId, userId } },
      update: { verdict, note: clampNote(note) },
      create: { bloomId, userId, seedId: bloom.seedId, verdict, note: clampNote(note) },
    })
    .catch(() => {});
  return getReckoning(userId, bloomId);
}

// Fan the "time to look back" invite out to everyone who was in the decision —
// the seed's creator, its contributors, members and followers — minus the
// person who triggered it. Links to the bloom, where the reckoning card lives.
// Best-effort; mirrors notifySeedAudience but with a bloom link + entity.
async function notifyReckoning(
  bloomId: string,
  seedId: string,
  seedTitle: string,
  actorId: string | null,
) {
  try {
    const start = new Date();
    const [seed, participants, follows, members] = await Promise.all([
      db.seed.findUnique({ where: { id: seedId }, select: { createdById: true } }).catch(() => null),
      db.contribution.findMany({
        where: { seedId, deletedAt: null },
        distinct: ["authorId"],
        select: { authorId: true },
      }),
      db.seedFollow.findMany({ where: { seedId }, select: { userId: true } }).catch(() => []),
      db.seedMember.findMany({ where: { seedId }, select: { userId: true } }).catch(() => []),
    ]);

    const exclude = new Set<string>(actorId ? [actorId] : []);
    const recipients = new Set<string>();
    const add = (id?: string | null) => {
      if (id && !exclude.has(id)) recipients.add(id);
    };
    add(seed?.createdById);
    for (const p of participants as { authorId: string }[]) add(p.authorId);
    for (const f of follows as { userId: string }[]) add(f.userId);
    for (const m of members as { userId: string }[]) add(m.userId);
    if (recipients.size === 0) return;

    const title = "Time to look back 🍂";
    const body = `How did “${seedTitle.slice(0, 60)}” turn out? Weigh in.`;
    const ids = [...recipients];
    await db.notification.createMany({
      data: ids.map((rid) => ({
        recipientId: rid,
        actorId,
        type: "reckoning",
        title,
        body,
        entityType: "bloom",
        entityId: bloomId,
      })),
    });
    const rows = await db.notification.findMany({
      where: {
        type: "reckoning",
        entityId: bloomId,
        recipientId: { in: ids },
        createdAt: { gte: start },
      },
      select: { id: true, recipientId: true },
    });
    await deliver(
      (rows as { id: string; recipientId: string }[]).map((r) => ({
        notificationId: r.id,
        recipientId: r.recipientId,
        type: "reckoning",
        push: { title, body },
        link: `/blooms/${bloomId}`,
      })),
    );
  } catch (err) {
    console.error("notifyReckoning failed", err);
  }
}

// The day-21 job: find current blooms old enough to reckon that haven't been
// opened yet, open them, and nudge their people. Bounded per run so one tick can
// never fan out unboundedly. Only the seed's CURRENT bloom is reckoned (a
// superseded version, e.g. after a reopen, is skipped). Returns how many opened.
export async function openDueReckonings(limit = 25): Promise<{ opened: number; ids: string[] }> {
  const cutoff = new Date(Date.now() - RECKON_DAYS * DAY_MS);
  // Raw scan: current bloom (seeds.bloom_id = blooms.id), old enough, not opened.
  // Best-effort — if bloom_reckoning_opens doesn't exist yet, this yields [].
  let due: { id: string; seed_id: string; title: string }[] = [];
  try {
    due = await db.$queryRawUnsafe<{ id: string; seed_id: string; title: string }[]>(
      `SELECT b.id, b.seed_id, b.title
         FROM "blooms" b
         JOIN "seeds" s ON s.id = b.seed_id AND s."bloom_id" = b.id
         LEFT JOIN "bloom_reckoning_opens" o ON o."bloom_id" = b.id
        WHERE b."bloomed_at" <= $1 AND o."bloom_id" IS NULL AND s."deleted_at" IS NULL
        ORDER BY b."bloomed_at" ASC
        LIMIT $2`,
      cutoff,
      limit,
    );
  } catch {
    return { opened: 0, ids: [] };
  }

  const ids: string[] = [];
  for (const b of due) {
    // Claim it first (idempotent) so a concurrent tick can't double-notify.
    await markOpened(b.id, b.seed_id, null);
    await notifyReckoning(b.id, b.seed_id, b.title, null);
    ids.push(b.id);
  }
  return { opened: ids.length, ids };
}
