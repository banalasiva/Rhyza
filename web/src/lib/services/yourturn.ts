import { db } from "@/lib/db";

// "It's your turn" — the things genuinely waiting on THIS person's action, so
// there's a concrete reason to come back. High-signal only: a decision the group
// is weighing in on without you yet, or someone who tagged you and is waiting.
export type YourTurnItem = {
  seedId: string;
  title: string;
  reason: "ask" | "weigh-in" | "mention";
  detail: string;
};

export async function getYourTurn(userId: string, cap = 6): Promise<YourTurnItem[]> {
  // The three sources are independent, so gather them CONCURRENTLY (each is its
  // own little query pipeline) and merge below in priority order — asks first,
  // then weigh-ins, then mentions — with dedup + cap. Previously these ran as
  // three sequential waves (~6 stacked round-trips).
  const [askItems, weighItems, mentionItems] = await Promise.all([
    gatherAsks(userId, cap).catch(() => [] as YourTurnItem[]),
    gatherWeighIn(userId, cap).catch(() => [] as YourTurnItem[]),
    gatherMentions(userId, cap).catch(() => [] as YourTurnItem[]),
  ]);

  const items: YourTurnItem[] = [];
  const seen = new Set<string>();
  for (const list of [askItems, weighItems, mentionItems]) {
    for (const it of list) {
      if (seen.has(it.seedId)) continue; // a seed only appears once, at its highest-priority reason
      seen.add(it.seedId);
      items.push(it);
      if (items.length >= cap) break;
    }
    if (items.length >= cap) break;
  }
  return items;
}

// ── 0. Someone asked YOU directly — the strongest, most personal pull ──
async function gatherAsks(userId: string, cap: number): Promise<YourTurnItem[]> {
  const asks = (await db.seedAsk.findMany({
    where: { askedId: userId, answeredAt: null },
    orderBy: { createdAt: "desc" },
    take: cap * 2,
    select: { seedId: true, askerId: true },
  })) as { seedId: string; askerId: string }[];
  if (!asks.length) return [];
  const seedIds = [...new Set(asks.map((a) => a.seedId))];
  const askerIds = [...new Set(asks.map((a) => a.askerId))];
  const [seeds, askers] = await Promise.all([
    db.seed.findMany({
      where: { id: { in: seedIds }, deletedAt: null, bloomId: null },
      select: { id: true, title: true },
    }),
    db.user.findMany({ where: { id: { in: askerIds } }, select: { id: true, name: true } }),
  ]);
  const titleById = new Map((seeds as { id: string; title: string }[]).map((s) => [s.id, s.title]));
  const nameById = new Map((askers as { id: string; name: string | null }[]).map((u) => [u.id, u.name]));
  const out: YourTurnItem[] = [];
  const used = new Set<string>();
  for (const a of asks) {
    if (used.has(a.seedId)) continue;
    const title = titleById.get(a.seedId);
    if (!title) continue; // seed gone, bloomed, or deleted
    used.add(a.seedId);
    const who = (nameById.get(a.askerId) || "").trim().split(/\s+/)[0] || "Someone";
    out.push({ seedId: a.seedId, title, reason: "ask", detail: `${who} asked for your take — they're waiting on you.` });
    if (out.length >= cap) break;
  }
  return out;
}

// ── 1. A decision is being weighed in on — others committed, you haven't ──
async function gatherWeighIn(userId: string, cap: number): Promise<YourTurnItem[]> {
  const others = await db.quorumBallot.findMany({
    where: { submitted: true, raterId: { not: userId } },
    distinct: ["seedId"],
    select: { seedId: true },
    take: 200,
  });
  const candidateIds = [...new Set((others as { seedId: string }[]).map((o) => o.seedId))];
  if (!candidateIds.length) return [];
  const [mine, locked] = await Promise.all([
    db.quorumBallot.findMany({
      where: { seedId: { in: candidateIds }, raterId: userId, submitted: true },
      distinct: ["seedId"],
      select: { seedId: true },
    }),
    db.quorumState
      .findMany({ where: { seedId: { in: candidateIds }, phase: "locked" }, select: { seedId: true } })
      .catch(() => [] as { seedId: string }[]),
  ]);
  const done = new Set<string>([
    ...(mine as { seedId: string }[]).map((m) => m.seedId),
    ...(locked as { seedId: string }[]).map((l) => l.seedId),
  ]);
  const need = candidateIds.filter((id) => !done.has(id));
  if (!need.length) return [];
  // Only seeds you actually belong to (creator / member / you've spoken in), still live.
  const seeds = await db.seed.findMany({
    where: {
      id: { in: need },
      deletedAt: null,
      bloomId: null,
      OR: [
        { createdById: userId },
        { members: { some: { userId } } },
        { contributions: { some: { authorId: userId, deletedAt: null } } },
      ],
    },
    orderBy: { lastActivityAt: "desc" },
    select: { id: true, title: true },
    take: cap,
  });
  return (seeds as { id: string; title: string }[]).map((s) => ({
    seedId: s.id,
    title: s.title,
    reason: "weigh-in" as const,
    detail: "The group is weighing in — add your voice before it's decided.",
  }));
}

// ── 2. Someone tagged you and you haven't been back ──
async function gatherMentions(userId: string, cap: number): Promise<YourTurnItem[]> {
  const mentions = await db.notification.findMany({
    where: { recipientId: userId, readAt: null, type: "mention", entityType: "seed" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { entityId: true },
  });
  const seedIds = [
    ...new Set((mentions as { entityId: string | null }[]).map((m) => m.entityId).filter(Boolean)),
  ] as string[];
  if (!seedIds.length) return [];
  const seeds = await db.seed.findMany({
    where: { id: { in: seedIds }, deletedAt: null },
    select: { id: true, title: true },
    take: cap,
  });
  return (seeds as { id: string; title: string }[]).map((s) => ({
    seedId: s.id,
    title: s.title,
    reason: "mention" as const,
    detail: "Someone tagged you — they're waiting for your take.",
  }));
}
