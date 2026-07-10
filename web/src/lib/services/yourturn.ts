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
  const items: YourTurnItem[] = [];
  const seen = new Set<string>();

  // ── 0. Someone asked YOU directly — the strongest, most personal pull ──
  try {
    const asks = (await db.seedAsk.findMany({
      where: { askedId: userId, answeredAt: null },
      orderBy: { createdAt: "desc" },
      take: cap * 2,
      select: { seedId: true, askerId: true },
    })) as { seedId: string; askerId: string }[];
    if (asks.length) {
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
      for (const a of asks) {
        if (seen.has(a.seedId)) continue;
        const title = titleById.get(a.seedId);
        if (!title) continue; // seed gone, bloomed, or deleted
        seen.add(a.seedId);
        const who = (nameById.get(a.askerId) || "").trim().split(/\s+/)[0] || "Someone";
        items.push({
          seedId: a.seedId,
          title,
          reason: "ask",
          detail: `${who} asked for your take — they're waiting on you.`,
        });
        if (items.length >= cap) break;
      }
    }
  } catch {
    /* seed_asks not migrated yet */
  }

  // ── 1. A decision is being weighed in on — others committed, you haven't ──
  try {
    const others = await db.quorumBallot.findMany({
      where: { submitted: true, raterId: { not: userId } },
      distinct: ["seedId"],
      select: { seedId: true },
      take: 200,
    });
    const candidateIds = [...new Set((others as { seedId: string }[]).map((o) => o.seedId))];
    if (candidateIds.length) {
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
      if (need.length) {
        // Only seeds you actually belong to (creator / member / you've spoken in),
        // still live (not bloomed).
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
        for (const s of seeds as { id: string; title: string }[]) {
          if (seen.has(s.id)) continue;
          seen.add(s.id);
          items.push({
            seedId: s.id,
            title: s.title,
            reason: "weigh-in",
            detail: "The group is weighing in — add your voice before it's decided.",
          });
        }
      }
    }
  } catch {
    /* quorum tables not migrated yet */
  }

  // ── 2. Someone tagged you and you haven't been back ──
  if (items.length < cap) {
    try {
      const mentions = await db.notification.findMany({
        where: { recipientId: userId, readAt: null, type: "mention", entityType: "seed" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { entityId: true },
      });
      const seedIds = [
        ...new Set((mentions as { entityId: string | null }[]).map((m) => m.entityId).filter(Boolean)),
      ].filter((id) => !seen.has(id as string)) as string[];
      if (seedIds.length) {
        const seeds = await db.seed.findMany({
          where: { id: { in: seedIds }, deletedAt: null },
          select: { id: true, title: true },
          take: cap - items.length,
        });
        for (const s of seeds as { id: string; title: string }[]) {
          if (seen.has(s.id)) continue;
          seen.add(s.id);
          items.push({
            seedId: s.id,
            title: s.title,
            reason: "mention",
            detail: "Someone tagged you — they're waiting for your take.",
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  return items.slice(0, cap);
}
