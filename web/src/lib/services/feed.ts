import { db } from "@/lib/db";
import { STAGES } from "@/lib/constants";

// The home feed — an infinite, private-first river of seeds worth your thought.
// Phase "mine" = seeds in your org you can see (your gardens, your private
// seeds), newest activity first. When those run out we roll into phase
// "public" = world-listed seeds from other orgs. Keyset pagination on
// (lastActivityAt, id) so infinite scroll never skips or repeats.

const PAGE = 10;

export type FeedItem = {
  id: string;
  title: string;
  stage: string;
  stageEmoji: string;
  visibility: "public" | "private";
  bloomId: string | null;
  scope: "mine" | "public";
  garden: { id: string; name: string; emoji: string };
  author: { id: string; name: string; image: string | null };
  contributionCount: number;
  lastActivityAt: string;
  latest: { text: string; author: string } | null;
};

type Cursor = { ph: "mine" | "public"; at?: string; id?: string };

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}
function decodeCursor(s?: string | null): Cursor {
  if (!s) return { ph: "mine" };
  try {
    const c = JSON.parse(Buffer.from(s, "base64url").toString());
    return c?.ph === "public" ? c : { ph: "mine", at: c?.at, id: c?.id };
  } catch {
    return { ph: "mine" };
  }
}

const feedSelect = {
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

// Keyset predicate for "strictly after" the cursor in (lastActivityAt desc, id desc).
function keyset(cursor: Cursor) {
  if (!cursor.at || !cursor.id) return [];
  const at = new Date(cursor.at);
  return [{ OR: [{ lastActivityAt: { lt: at } }, { lastActivityAt: at, id: { lt: cursor.id } }] }];
}

const stageEmojiOf = (stage: string) => STAGES.find((s) => s.key === stage)?.emoji ?? "🌱";

function snippet(content: unknown): string {
  const c = content as { text?: string } | null;
  const t = (c?.text ?? "").replace(/\s+/g, " ").trim();
  return t.length > 140 ? `${t.slice(0, 140)}…` : t;
}

type Row = {
  id: string;
  title: string;
  stage: string;
  visibility: string;
  bloomId: string | null;
  lastActivityAt: Date;
  createdBy: { id: string; name: string; image: string | null };
  garden: { id: string; name: string; emoji: string };
  _count: { contributions: number };
  contributions: { content: unknown; author: { name: string } | null }[];
};

function toItem(s: Row, scope: "mine" | "public"): FeedItem {
  const latest = s.contributions[0];
  return {
    id: s.id,
    title: s.title,
    stage: s.stage,
    stageEmoji: stageEmojiOf(s.stage),
    visibility: s.visibility as "public" | "private",
    bloomId: s.bloomId,
    scope,
    garden: s.garden,
    author: s.createdBy,
    contributionCount: s._count.contributions,
    lastActivityAt: s.lastActivityAt.toISOString(),
    latest: latest ? { text: snippet(latest.content), author: latest.author?.name || "Someone" } : null,
  };
}

async function fetchMine(userId: string, orgId: string, cursor: Cursor) {
  return (await db.seed.findMany({
    where: {
      deletedAt: null,
      garden: { orgId },
      AND: [
        { OR: [{ visibility: "public" }, { createdById: userId }, { members: { some: { userId } } }] },
        ...keyset(cursor),
      ],
    },
    orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    select: feedSelect,
  })) as unknown as Row[];
}

async function fetchPublic(orgId: string | null, cursor: Cursor) {
  return (await db.seed.findMany({
    where: {
      deletedAt: null,
      listed: true,
      visibility: "public",
      // Other orgs only — the viewer's own org already came through phase "mine".
      ...(orgId ? { garden: { orgId: { not: orgId } } } : {}),
      AND: keyset(cursor),
    },
    orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    select: feedSelect,
  })) as unknown as Row[];
}

export async function getFeed(
  userId: string,
  orgId: string | null,
  cursorStr?: string | null,
): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  let cursor = decodeCursor(cursorStr);

  // Phase "mine" (only when the viewer belongs to an org).
  if (cursor.ph === "mine" && orgId) {
    const rows = await fetchMine(userId, orgId, cursor);
    if (rows.length > 0) {
      const more = rows.length > PAGE;
      const page = rows.slice(0, PAGE);
      const last = page[page.length - 1];
      const next = more
        ? encodeCursor({ ph: "mine", at: last.lastActivityAt.toISOString(), id: last.id })
        : encodeCursor({ ph: "public" }); // mine exhausted → roll into the community
      return { items: page.map((r) => toItem(r, "mine")), nextCursor: next };
    }
    // No personal seeds at all — fall straight through to public.
    cursor = { ph: "public" };
  } else if (cursor.ph === "mine") {
    cursor = { ph: "public" };
  }

  // Phase "public".
  const rows = await fetchPublic(orgId, cursor);
  const more = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  const next = more
    ? encodeCursor({ ph: "public", at: page[page.length - 1].lastActivityAt.toISOString(), id: page[page.length - 1].id })
    : null;
  return { items: page.map((r) => toItem(r, "public")), nextCursor: next };
}
