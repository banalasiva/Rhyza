import { db } from "@/lib/db";

// The one number that matters most for a multiplayer decision app: does a
// planted seed actually pull in a SECOND real person who engages? Everything
// downstream (notifications, blooms, reckonings) is firing blanks until it does.
//
// Derived entirely from data we already store — no external analytics pipeline:
//   • a seed is "multiplayer" once any human OTHER than its creator contributes
//   • "within 48h" gates that on the first such contribution's timing
//   • invite/ask funnels come from the invites + seed_asks tables
// Best-effort: any hiccup returns ok:false so the admin page still renders.

const DAY_MS = 24 * 60 * 60 * 1000;

export type ActivationMetrics = {
  ok: boolean;
  total: number;
  multiplayer: number;
  multiplayer48h: number;
  medianHoursToSecond: number | null;
  invitesSent: number;
  invitesAccepted: number;
  asksSent: number;
  asksAnswered: number;
  recent: { id: string; title: string; humans: number; ageHours: number; activated: boolean }[];
};

const EMPTY: ActivationMetrics = {
  ok: false,
  total: 0,
  multiplayer: 0,
  multiplayer48h: 0,
  medianHoursToSecond: null,
  invitesSent: 0,
  invitesAccepted: 0,
  asksSent: 0,
  asksAnswered: 0,
  recent: [],
};

export async function getActivationMetrics(): Promise<ActivationMetrics> {
  try {
    // The AI teammates author contributions but are never "people" — exclude them.
    const aiUsers = await db.user.findMany({
      where: { name: { in: ["Claude", "ChatGPT"] } },
      select: { id: true },
    });
    const aiIds = new Set(aiUsers.map((u) => u.id));

    const seeds = await db.seed.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true, createdAt: true, createdById: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    if (seeds.length === 0) return { ...EMPTY, ok: true };

    const contribs = await db.contribution.findMany({
      where: { deletedAt: null, seedId: { in: seeds.map((s) => s.id) } },
      select: { seedId: true, authorId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 50000,
    });

    const creatorBy = new Map(seeds.map((s) => [s.id, s.createdById]));
    const humansBySeed = new Map<string, Set<string>>();
    // First contribution by a human who ISN'T the creator = the "second person showed up" moment.
    const secondAtBySeed = new Map<string, Date>();
    for (const c of contribs) {
      if (aiIds.has(c.authorId)) continue;
      let set = humansBySeed.get(c.seedId);
      if (!set) {
        set = new Set();
        humansBySeed.set(c.seedId, set);
      }
      set.add(c.authorId);
      if (c.authorId !== creatorBy.get(c.seedId) && !secondAtBySeed.has(c.seedId)) {
        secondAtBySeed.set(c.seedId, c.createdAt);
      }
    }

    let multiplayer = 0;
    let multiplayer48h = 0;
    const hoursToSecond: number[] = [];
    for (const s of seeds) {
      const secondAt = secondAtBySeed.get(s.id);
      if (!secondAt) continue;
      multiplayer++;
      const gap = secondAt.getTime() - s.createdAt.getTime();
      hoursToSecond.push(gap / 3_600_000);
      if (gap <= 2 * DAY_MS) multiplayer48h++;
    }
    hoursToSecond.sort((a, b) => a - b);
    const medianHoursToSecond = hoursToSecond.length
      ? hoursToSecond[Math.floor((hoursToSecond.length - 1) / 2)]
      : null;

    const now = Date.now();
    const recent = seeds.slice(0, 8).map((s) => ({
      id: s.id,
      title: s.title,
      humans: humansBySeed.get(s.id)?.size ?? 0,
      ageHours: (now - s.createdAt.getTime()) / 3_600_000,
      activated: secondAtBySeed.has(s.id),
    }));

    // Invite + ask funnels (best-effort — tables may lag a migration).
    const [invitesSent, invitesAccepted, asksSent, asksAnswered] = await Promise.all([
      db.invite.count().catch(() => 0),
      db.invite.count({ where: { status: "accepted" } }).catch(() => 0),
      db.seedAsk.count().catch(() => 0),
      db.seedAsk.count({ where: { answeredAt: { not: null } } }).catch(() => 0),
    ]);

    return {
      ok: true,
      total: seeds.length,
      multiplayer,
      multiplayer48h,
      medianHoursToSecond,
      invitesSent,
      invitesAccepted,
      asksSent,
      asksAnswered,
      recent,
    };
  } catch {
    return EMPTY;
  }
}
