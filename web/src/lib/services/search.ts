import { db } from "@/lib/db";
import { STAGES } from "@/lib/constants";
import { deserializeMentions } from "@/lib/mentions";

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
const textOf = (content: unknown) =>
  deserializeMentions((content as { text?: string } | null)?.text ?? "");

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
    // Messages inside seeds the viewer can access. (JSON body match is
    // case-sensitive — a full-text index is the planned upgrade.)
    db.contribution.findMany({
      where: {
        deletedAt: null,
        content: { path: ["text"], string_contains: q },
        seed: { deletedAt: null, garden: { orgId }, OR: seedVisibleOr(userId) },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        seedId: true,
        content: true,
        author: { select: { name: true } },
        seed: { select: { title: true } },
      },
    }),
    // Gardens by name.
    db.garden.findMany({
      where: { orgId, AND: [{ OR: gardenVisibleOr(userId) }, { name: ci }] },
      orderBy: { name: "asc" },
      take: 6,
      select: { id: true, name: true, emoji: true },
    }),
    // People in the org (excluding the AI participants).
    db.orgMember.findMany({
      where: {
        orgId,
        user: { deletedAt: null, name: ci, NOT: { name: { in: ["Claude", "ChatGPT"] } } },
      },
      take: 6,
      select: { user: { select: { id: true, name: true, image: true } } },
    }),
  ]);

  const seedResults = seeds.map((s) => ({
    id: s.id,
    title: s.title,
    stageEmoji: stageEmoji(s.stage),
    gardenName: s.garden?.name ?? "",
    snippet: s.content ? snip(s.content) : null,
  }));
  const messageResults = messages.map((m) => ({
    id: m.id,
    seedId: m.seedId,
    seedTitle: m.seed?.title ?? "",
    author: m.author?.name ?? "Someone",
    snippet: snip(textOf(m.content)),
  }));
  const gardenResults = gardens.map((g) => ({ id: g.id, name: g.name, emoji: g.emoji }));
  const peopleResults = people.map((p) => p.user).filter((u): u is NonNullable<typeof u> => !!u);

  return {
    query: q,
    seeds: seedResults,
    messages: messageResults,
    gardens: gardenResults,
    people: peopleResults,
    total: seedResults.length + messageResults.length + gardenResults.length + peopleResults.length,
  };
}
