import { db } from "@/lib/db";
import { inferPersonTopics } from "@/lib/ai";

// A person shows at most this many topics on their profile.
const MAX_TOPICS = 20;

// The titles of the seeds a person created or took part in — the raw material
// Claude reads to name the areas they're most involved in. Deduped by seed,
// capped so inference stays fast and cheap.
async function personSeedTitles(userId: string, cap = 60): Promise<string[]> {
  const [created, contributed] = await Promise.all([
    db.seed.findMany({
      where: { createdById: userId, deletedAt: null },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: cap,
    }),
    db.contribution.findMany({
      where: { authorId: userId, deletedAt: null },
      distinct: ["seedId"],
      select: { seed: { select: { id: true, title: true } } },
      take: cap,
    }),
  ]);

  const seen = new Set<string>();
  const titles: string[] = [];
  for (const s of created) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    if (s.title?.trim()) titles.push(s.title.trim());
  }
  for (const c of contributed) {
    const s = c.seed;
    if (!s || seen.has(s.id)) continue;
    seen.add(s.id);
    if (s.title?.trim()) titles.push(s.title.trim());
  }
  return titles.slice(0, cap);
}

// Read the free-form topics on a person's profile — their manual picks first,
// then Claude's auto-inferred ones, capped. Resilient to the user_topics table
// not being migrated yet.
export async function getUserTopics(userId: string): Promise<string[]> {
  const rows = await db.userTopic
    .findMany({
      where: { userId },
      orderBy: [{ manual: "desc" }, { createdAt: "asc" }],
      take: MAX_TOPICS,
    })
    .catch(() => [] as { topic: string }[]);
  return rows.map((r) => r.topic);
}

// Re-infer a person's auto topics from their current activity and store them,
// replacing the previous auto set but PRESERVING any topics they added by hand
// (manual = true). Returns the fresh list. Best-effort: on any AI/DB failure it
// leaves what's there and returns the current list.
export async function refreshUserTopics(userId: string): Promise<string[]> {
  try {
    const titles = await personSeedTitles(userId);
    const topics = await inferPersonTopics(titles);
    await db.userTopic.deleteMany({ where: { userId, manual: false } });
    if (topics.length > 0) {
      await db.userTopic.createMany({
        data: topics.map((topic) => ({ userId, topic, manual: false })),
        skipDuplicates: true, // a topic they already added by hand stays manual
      });
    }
  } catch (err) {
    console.error("refreshUserTopics failed", err);
  }
  return getUserTopics(userId);
}

// A person adds a topic to their own profile by hand (kept across refreshes).
export async function addUserTopic(userId: string, topic: string): Promise<string[]> {
  const clean = topic.trim().replace(/\s+/g, " ").slice(0, 40);
  if (clean) {
    await db.userTopic
      .upsert({
        where: { userId_topic: { userId, topic: clean } },
        update: { manual: true },
        create: { userId, topic: clean, manual: true },
      })
      .catch((err) => console.error("addUserTopic failed", err));
  }
  return getUserTopics(userId);
}

// A person removes a topic from their profile (auto or manual).
export async function removeUserTopic(userId: string, topic: string): Promise<string[]> {
  await db.userTopic
    .deleteMany({ where: { userId, topic } })
    .catch((err) => console.error("removeUserTopic failed", err));
  return getUserTopics(userId);
}

// One-time-ish backfill: fill in profile topics for people who've planted seeds
// but don't have topics yet (e.g. everyone from before this feature shipped).
// Batched so a single admin click can't time out — re-run until `remaining` hits
// zero. Each person is a full Claude inference, so batches are small.
export async function backfillUserTopics(limit = 6): Promise<{ tagged: number; remaining: number }> {
  const authors = await db.seed.findMany({
    where: { deletedAt: null },
    distinct: ["createdById"],
    select: { createdById: true },
    take: 1000,
  });
  const ids: string[] = [
    ...new Set((authors as { createdById: string }[]).map((a) => a.createdById)),
  ];
  if (ids.length === 0) return { tagged: 0, remaining: 0 };

  const have = await db.userTopic.findMany({
    where: { userId: { in: ids } },
    distinct: ["userId"],
    select: { userId: true },
  });
  const haveSet = new Set(have.map((h: { userId: string }) => h.userId));
  const todo = ids.filter((id) => !haveSet.has(id));

  let tagged = 0;
  for (const id of todo.slice(0, limit)) {
    const topics = await refreshUserTopics(id);
    if (topics.length) tagged++;
  }

  const haveAfter = await db.userTopic.findMany({
    where: { userId: { in: ids } },
    distinct: ["userId"],
    select: { userId: true },
  });
  const haveAfterSet = new Set(haveAfter.map((h: { userId: string }) => h.userId));
  const remaining = ids.filter((id) => !haveAfterSet.has(id)).length;
  return { tagged, remaining };
}

// Topics for a profile view: read what's stored; if there's none yet but the
// person has activity, generate them once (lazily) so a first visit isn't empty.
async function profileTopics(userId: string, hasActivity: boolean): Promise<string[]> {
  const existing = await getUserTopics(userId);
  if (existing.length > 0 || !hasActivity) return existing;
  return refreshUserTopics(userId);
}

// How many times a person has tagged each AI, shown on their profile. Reads the
// ai_tag_events log. Resilient to the table not being migrated yet.
async function aiTagCounts(userId: string): Promise<{ claude: number; chatgpt: number }> {
  try {
    const [claude, chatgpt] = await Promise.all([
      db.aiTagEvent.count({ where: { userId, provider: "claude" } }),
      db.aiTagEvent.count({ where: { userId, provider: "chatgpt" } }),
    ]);
    return { claude, chatgpt };
  } catch {
    return { claude: 0, chatgpt: 0 };
  }
}

// A public profile — what anyone signed in can see about a person: their name,
// photo, a short bio, a few safe activity counts, the free-form topics they're
// involved in, and the recognition the community has given them (labels only, no
// private garden names). Deliberately leaks no private seed/garden titles.
export async function getPublicProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, image: true, bio: true, createdAt: true, deletedAt: true },
  });
  if (!user || user.deletedAt || user.name === "Claude" || user.name === "ChatGPT") return null;

  const [contributions, seedsPlanted, bloomsHelped, recognitions, aiTags] = await Promise.all([
    db.contribution.count({ where: { authorId: userId, deletedAt: null } }),
    db.seed.count({ where: { createdById: userId, deletedAt: null } }),
    db.seed.count({ where: { createdById: userId, deletedAt: null, bloomId: { not: null } } }),
    db.userRecognition
      .findMany({ where: { userId }, include: { label: true } })
      .catch(() => [] as { labelKey: string; label: { emoji: string | null; label: string | null } | null }[]),
    aiTagCounts(userId),
  ]);

  const topics = await profileTopics(userId, contributions > 0 || seedsPlanted > 0).catch(
    () => [] as string[],
  );

  // Aggregate recognitions by label (across gardens) — count, not garden names.
  const byLabel = new Map<string, { emoji: string; label: string; count: number }>();
  for (const r of recognitions as { labelKey: string; label: { emoji: string | null; label: string | null } | null }[]) {
    const cur =
      byLabel.get(r.labelKey) ?? { emoji: r.label?.emoji ?? "✦", label: r.label?.label ?? r.labelKey, count: 0 };
    cur.count += 1;
    byLabel.set(r.labelKey, cur);
  }

  return {
    id: user.id,
    name: user.name,
    image: user.image,
    bio: user.bio,
    joinedAt: user.createdAt.toISOString(),
    stats: { contributions, seedsPlanted, bloomsHelped },
    aiTags,
    recognitions: [...byLabel.values()].sort((a, b) => b.count - a.count),
    topics,
  };
}
