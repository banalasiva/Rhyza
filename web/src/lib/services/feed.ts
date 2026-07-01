import { db } from "@/lib/db";
import { STAGES } from "@/lib/constants";

// The home feed — an infinite, private-first river of seeds worth your thought,
// with a never-empty tail of blooms (finished decisions are evergreen).
//   phase "mine"   → seeds in your org you can see, newest activity first
//   phase "public" → world-listed seeds from other orgs
//   phase "blooms" → the community's blooms, so the feed always has something
// Keyset pagination on (activity, id) so infinite scroll never skips/repeats.

const PAGE = 10;

export type FeedItem = {
  id: string;
  title: string;
  stage: string;
  stageEmoji: string;
  visibility: "public" | "private";
  bloomId: string | null;
  scope: "mine" | "public" | "bloom";
  garden: { id: string; name: string; emoji: string };
  author: { id: string; name: string; image: string | null };
  contributionCount: number;
  lastActivityAt: string;
  latest: { text: string; author: string } | null;
};

type Phase = "mine" | "public" | "blooms";
type Cursor = { ph: Phase; at?: string; id?: string };
const ORDER: Phase[] = ["mine", "public", "blooms"];

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}
function decodeCursor(s?: string | null): Cursor {
  if (!s) return { ph: "mine" };
  try {
    const c = JSON.parse(Buffer.from(s, "base64url").toString());
    const ph: Phase = ORDER.includes(c?.ph) ? c.ph : "mine";
    return { ph, at: c?.at, id: c?.id };
  } catch {
    return { ph: "mine" };
  }
}

// Keyset predicate for "strictly after" the cursor in (<field> desc, id desc).
function keysetOn(field: "lastActivityAt" | "bloomedAt", cursor: Cursor): object[] {
  if (!cursor.at || !cursor.id) return [];
  const at = new Date(cursor.at);
  return [{ OR: [{ [field]: { lt: at } }, { [field]: at, id: { lt: cursor.id } }] }];
}

const seedSelect = {
  id: true,
  title: true,
  stage: true,
  visibility: true,
  bloomId: true,
  lastActivityAt: true,
  createdBy: { select: { id: true, name: true, image: true } },
  garden: { select: { id: true, name: true, emoji: true } },
  _count: { select: { contributions: true } },
  contributions: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { content: true, author: { select: { name: true } } },
  },
} as const;

const stageEmojiOf = (stage: string) => STAGES.find((s) => s.key === stage)?.emoji ?? "🌱";

function snippet(text: string): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > 140 ? `${t.slice(0, 140)}…` : t;
}
const textOf = (content: unknown) => snippet((content as { text?: string } | null)?.text ?? "");

/* eslint-disable @typescript-eslint/no-explicit-any */
function seedToItem(s: any, scope: "mine" | "public"): FeedItem {
  const latest = s.contributions[0];
  return {
    id: s.id,
    title: s.title,
    stage: s.stage,
    stageEmoji: stageEmojiOf(s.stage),
    visibility: s.visibility,
    bloomId: s.bloomId,
    scope,
    garden: s.garden,
    author: s.createdBy,
    contributionCount: s._count.contributions,
    lastActivityAt: s.lastActivityAt.toISOString(),
    latest: latest ? { text: textOf(latest.content), author: latest.author?.name || "Someone" } : null,
  };
}

function bloomToItem(b: any): FeedItem {
  return {
    id: b.seed.id, // same id as any bloomed-seed card, so the client de-dupes
    title: b.title,
    stage: "bloomed",
    stageEmoji: "🌸",
    visibility: "public",
    bloomId: b.id,
    scope: "bloom",
    garden: b.garden,
    author: b.createdBy ?? { id: "", name: "The group", image: null },
    contributionCount: b.seed._count.contributions,
    lastActivityAt: b.bloomedAt.toISOString(),
    latest: { text: snippet(b.summary), author: "The group" },
  };
}

function mineWhere(userId: string, orgId: string, cursor: Cursor) {
  return {
    deletedAt: null,
    garden: { orgId },
    AND: [
      { OR: [{ visibility: "public" }, { createdById: userId }, { members: { some: { userId } } }] },
      ...keysetOn("lastActivityAt", cursor),
    ],
  };
}
function publicWhere(orgId: string | null, cursor: Cursor) {
  return {
    deletedAt: null,
    listed: true,
    visibility: "public",
    ...(orgId ? { garden: { orgId: { not: orgId } } } : {}),
    AND: keysetOn("lastActivityAt", cursor),
  };
}
function bloomsWhere(userId: string, orgId: string | null, cursor: Cursor) {
  const visible: object[] = [{ seed: { listed: true, visibility: "public" } }];
  if (orgId) {
    visible.unshift({
      garden: { orgId },
      seed: { OR: [{ visibility: "public" }, { createdById: userId }, { members: { some: { userId } } }] },
    });
  }
  return { AND: [{ OR: visible }, ...keysetOn("bloomedAt", cursor)] };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function getFeed(
  userId: string,
  orgId: string | null,
  cursorStr?: string | null,
): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  const cursor = decodeCursor(cursorStr);
  let idx = ORDER.indexOf(cursor.ph);
  if (idx < 0) idx = 0;

  // Walk the phases; an empty phase falls straight through to the next so the
  // caller never gets a blank page in the middle of the feed.
  for (; idx < ORDER.length; idx++) {
    const ph = ORDER[idx];
    const c: Cursor = cursor.ph === ph ? cursor : { ph };
    const nextPhaseCursor = () => (idx + 1 < ORDER.length ? encodeCursor({ ph: ORDER[idx + 1] }) : null);

    if (ph === "mine") {
      if (!orgId) continue;
      const rows = await db.seed.findMany({
        where: mineWhere(userId, orgId, c),
        orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
        take: PAGE + 1,
        select: seedSelect,
      });
      if (rows.length === 0) continue;
      const page = rows.slice(0, PAGE);
      const last = page[page.length - 1];
      const next =
        rows.length > PAGE
          ? encodeCursor({ ph: "mine", at: last.lastActivityAt.toISOString(), id: last.id })
          : nextPhaseCursor();
      return { items: page.map((r) => seedToItem(r, "mine")), nextCursor: next };
    }

    if (ph === "public") {
      const rows = await db.seed.findMany({
        where: publicWhere(orgId, c),
        orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
        take: PAGE + 1,
        select: seedSelect,
      });
      if (rows.length === 0) continue;
      const page = rows.slice(0, PAGE);
      const last = page[page.length - 1];
      const next =
        rows.length > PAGE
          ? encodeCursor({ ph: "public", at: last.lastActivityAt.toISOString(), id: last.id })
          : nextPhaseCursor();
      return { items: page.map((r) => seedToItem(r, "public")), nextCursor: next };
    }

    // blooms
    const rows = await db.bloom.findMany({
      where: bloomsWhere(userId, orgId, c),
      orderBy: [{ bloomedAt: "desc" }, { id: "desc" }],
      take: PAGE + 1,
      select: {
        id: true,
        title: true,
        summary: true,
        bloomedAt: true,
        seed: { select: { id: true, _count: { select: { contributions: true } } } },
        garden: { select: { id: true, name: true, emoji: true } },
        createdBy: { select: { id: true, name: true, image: true } },
      },
    });
    if (rows.length === 0) continue;
    const page = rows.slice(0, PAGE);
    const last = page[page.length - 1];
    const next =
      rows.length > PAGE
        ? encodeCursor({ ph: "blooms", at: last.bloomedAt.toISOString(), id: last.id })
        : null;
    return { items: page.map(bloomToItem), nextCursor: next };
  }

  return { items: [], nextCursor: null };
}
