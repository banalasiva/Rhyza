import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { STAGES } from "@/lib/constants";
import { deserializeMentions } from "@/lib/mentions";
import { displayName } from "@/lib/display-name";

// Search across everything a person can actually see — seeds (questions),
// messages inside them, gardens, and people. Authorisation mirrors the feed:
// only content in the viewer's org that's public, created by them, or that
// they're a member of is ever returned. Cross-org content never leaks.

export type SearchResults = {
  query: string;
  seeds: { id: string; title: string; stageEmoji: string; gardenName: string; snippet: string | null }[];
  messages: { id: string; seedId: string; seedTitle: string; author: string; snippet: string }[];
  gardens: { id: string; name: string; emoji: string }[];
  people: { id: string; name: string | null; image: string | null }[];
  total: number;
};

// The OR of visibility rules that decides whether a viewer may see a seed.
function seedVisibleOr(userId: string) {
  return [
    { visibility: "public" as const },
    { createdById: userId },
    { members: { some: { userId } } },
  ];
}
function gardenVisibleOr(userId: string) {
  return [
    { visibility: "public" as const },
    { createdById: userId },
    { members: { some: { userId } } },
  ];
}

const stageEmoji = (s: string) => STAGES.find((x) => x.key === s)?.emoji ?? "🌱";
function snip(t: string, n = 140): string {
  const clean = t.replace(/\s+/g, " ").trim();
  return clean.length > n ? `${clean.slice(0, n)}…` : clean;
}
// Message search via Postgres full-text: case-insensitive, word-stemmed, and
// relevance-ranked over the GIN index on contributions.content->>'text'.
// Authorisation stays in Prisma — we resolve the seed ids the viewer may see
// first, then rank messages within them. Any raw-query failure degrades to [],
// so one bad group never breaks the whole search.
async function searchMessages(
  userId: string,
  orgId: string,
  q: string,
): Promise<SearchResults["messages"]> {
  const accessible = await db.seed.findMany({
    where: { deletedAt: null, garden: { orgId }, OR: seedVisibleOr(userId) },
    select: { id: true },
    take: 2000,
  });
  const ids = accessible.map((s) => s.id);
  if (ids.length === 0) return [];
  try {
    const rows = await db.$queryRaw<
      { id: string; seed_id: string; text: string | null; author: string | null; seed_title: string }[]
    >(Prisma.sql`
      SELECT c."id", c."seed_id", c."content"->>'text' AS text, u."name" AS author, s."title" AS seed_title
      FROM "contributions" c
      JOIN "users" u ON u."id" = c."author_id"
      JOIN "seeds" s ON s."id" = c."seed_id"
      WHERE c."deleted_at" IS NULL
        AND c."seed_id"::text IN (${Prisma.join(ids)})
        AND to_tsvector('english', coalesce(c."content"->>'text', '')) @@ websearch_to_tsquery('english', ${q})
      ORDER BY ts_rank(
        to_tsvector('english', coalesce(c."content"->>'text', '')),
        websearch_to_tsquery('english', ${q})
      ) DESC, c."created_at" DESC
      LIMIT 8
    `);
    return rows.map((r) => ({
      id: r.id,
      seedId: r.seed_id,
      seedTitle: r.seed_title ?? "",
      author: r.author ?? "Someone",
      snippet: snip(deserializeMentions(r.text ?? "")),
    }));
  } catch (err) {
    console.error("[search] message full-text query failed", err);
    return [];
  }
}

export async function search(userId: string, orgId: string, raw: string): Promise<SearchResults> {
  const q = raw.trim();
  const empty: SearchResults = { query: q, seeds: [], messages: [], gardens: [], people: [], total: 0 };
  if (q.length < 2) return empty;

  const ci = { contains: q, mode: "insensitive" as const };

  const [seeds, messages, gardens, people] = await Promise.all([
    // Seeds by title or framing.
    db.seed.findMany({
      where: {
        deletedAt: null,
        garden: { orgId },
        AND: [{ OR: seedVisibleOr(userId) }, { OR: [{ title: ci }, { content: ci }] }],
      },
      orderBy: { lastActivityAt: "desc" },
      take: 8,
      select: { id: true, title: true, stage: true, content: true, garden: { select: { name: true } } },
    }),
    // Messages by body — full-text, case-insensitive, relevance-ranked.
    searchMessages(userId, orgId, q),
    // Gardens by name.
    db.garden.findMany({
      where: { orgId, AND: [{ OR: gardenVisibleOr(userId) }, { name: ci }] },
      orderBy: { name: "asc" },
      take: 6,
      select: { id: true, name: true, emoji: true },
    }),
    // People across ThinkThru, by name OR email — profiles are public, so anyone
    // can be found (excluding the AI participants and deleted accounts). Email is
    // essential: a freshly-invited person often has NO name yet, so name-only
    // search can't surface them — but whoever invited them knows their email.
    db.user.findMany({
      where: {
        deletedAt: null,
        OR: [{ name: ci }, { email: ci }],
        NOT: { name: { in: ["Claude", "ChatGPT"] } },
      },
      orderBy: { name: "asc" },
      take: 8,
      select: { id: true, name: true, email: true, image: true },
    }),
  ]);

  const seedResults = seeds.map((s) => ({
    id: s.id,
    title: s.title,
    stageEmoji: stageEmoji(s.stage),
    gardenName: s.garden?.name ?? "",
    snippet: s.content ? snip(s.content) : null,
  }));
  const messageResults = messages; // already the final shape from searchMessages
  const gardenResults = gardens.map((g) => ({ id: g.id, name: g.name, emoji: g.emoji }));
  // Humanize the email into a name so a person who hasn't set one yet still
  // shows up as something readable and clickable (not a blank row).
  const peopleResults = (people as { id: string; name: string | null; email: string | null; image: string | null }[]).map(
    (u) => ({ id: u.id, name: displayName(u), image: u.image }),
  );

  return {
    query: q,
    seeds: seedResults,
    messages: messageResults,
    gardens: gardenResults,
    people: peopleResults,
    total: seedResults.length + messageResults.length + gardenResults.length + peopleResults.length,
  };
}
