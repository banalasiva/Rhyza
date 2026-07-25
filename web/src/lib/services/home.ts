import { db } from "@/lib/db";
import { seedSelect, seedToItem, type FeedItem } from "@/lib/services/feed";

// Garden-grouped Home. The landing screen stays, but instead of a flat river of
// seeds it groups your active decisions under the garden (relationship group)
// they belong to — pinned gardens first, then the garden with the most recent
// activity, and within each garden the newest seed first. So the very first card
// you see is the most-active decision, but you always see which group it's in.

export type HomeGardenGroup = {
  garden: { id: string; name: string; emoji: string; visibility: "public" | "private" };
  pinned: boolean;
  lastActivityAt: string | null;
  seeds: FeedItem[];
};

// Cap the seeds shown per garden on Home (open the garden to see the rest).
const PER_GARDEN = 12;

export async function getHomeGardens(userId: string): Promise<HomeGardenGroup[]> {
  // Gardens you actually belong to (relationship groups): ones you created or are
  // a member of — cross-org, so a group someone added you to still shows.
  const gardens = await db.garden.findMany({
    where: { OR: [{ createdById: userId }, { members: { some: { userId } } }] },
    select: {
      id: true,
      name: true,
      emoji: true,
      visibility: true,
      seeds: {
        where: {
          deletedAt: null,
          bloomId: null, // active decisions only; blooms live in the garden's history
          OR: [
            { visibility: "public" },
            { createdById: userId },
            { members: { some: { userId } } },
          ],
        },
        orderBy: { lastActivityAt: "desc" },
        take: PER_GARDEN,
        select: seedSelect,
      },
    },
  });

  // Per-user hide + pin marks. Best-effort: a missing table (pre-migration) must
  // never break Home, so fall back to empty.
  const [dismissRows, pinRows] = await Promise.all([
    db.seedDismissal
      .findMany({ where: { userId }, select: { seedId: true, createdAt: true } })
      .catch(() => [] as { seedId: string; createdAt: Date }[]),
    db.gardenPin
      .findMany({ where: { userId }, select: { gardenId: true } })
      .catch(() => [] as { gardenId: string }[]),
  ]);
  const dismissedAt = new Map(dismissRows.map((d) => [d.seedId, d.createdAt]));
  const pinned = new Set(pinRows.map((p) => p.gardenId));

  const groups: HomeGardenGroup[] = [];
  for (const g of gardens) {
    // Drop seeds you've hidden — unless they've had activity since you hid them,
    // in which case they quietly come back (WhatsApp-archive behaviour).
    const visible = g.seeds.filter((s) => {
      const at = dismissedAt.get(s.id);
      return !at || s.lastActivityAt > at;
    });
    const isPinned = pinned.has(g.id);
    // Show a garden if it has something to read, or you've pinned it (so a group
    // you want kept on top stays visible even when it's quiet).
    if (visible.length === 0 && !isPinned) continue;
    const items = visible.map((s) => seedToItem(s, "mine"));
    groups.push({
      garden: {
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        visibility: g.visibility as "public" | "private",
      },
      pinned: isPinned,
      lastActivityAt: items[0]?.lastActivityAt ?? null,
      seeds: items,
    });
  }

  // Pinned first, then most-recently-active. Seeds inside are already newest
  // first, so the top card of the top group is the single most-active decision.
  groups.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const at = a.lastActivityAt ?? "";
    const bt = b.lastActivityAt ?? "";
    return at < bt ? 1 : at > bt ? -1 : 0;
  });
  return groups;
}
