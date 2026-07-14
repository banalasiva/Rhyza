import { db } from "@/lib/db";
import { DIMENSIONS } from "@/lib/constants";
import { displayName } from "@/lib/display-name";
import type { DimSlice } from "@/lib/fingerprint";
import { getFollowContext } from "@/lib/services/follows";
import {
  inferPersonTopics,
  describeContributionStyle,
  parseReflectionPoints,
  type PersonMessage,
} from "@/lib/ai";

// A person shows at most this many topics on their profile.
const MAX_TOPICS = 20;

// ── Per-section profile privacy ───────────────────────────────────────────

// The profile sections a person can make public or private, and the default for
// each. "How you show up" can surface sensitive read, so it's PRIVATE first;
// the rest are public by default.
export const PROFILE_SECTIONS = ["reflection", "topics", "seeds", "aiTags", "fingerprint"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

const SECTION_PUBLIC_DEFAULT: Record<ProfileSection, boolean> = {
  reflection: false, // sensitive → private first
  topics: true,
  seeds: true,
  aiTags: true,
  fingerprint: true,
};

export type SectionVisibility = Record<ProfileSection, boolean>;

// A person's per-section visibility, defaults filled in for any unset section.
export async function getSectionVisibility(userId: string): Promise<SectionVisibility> {
  const map: SectionVisibility = { ...SECTION_PUBLIC_DEFAULT };
  const rows = await db.userSectionVisibility
    .findMany({ where: { userId }, select: { section: true, public: true } })
    .catch(() => [] as { section: string; public: boolean }[]);
  for (const r of rows as { section: string; public: boolean }[]) {
    if ((PROFILE_SECTIONS as readonly string[]).includes(r.section)) {
      map[r.section as ProfileSection] = r.public;
    }
  }
  return map;
}

// Set one section public or private for a person.
export async function setSectionVisibility(
  userId: string,
  section: ProfileSection,
  isPublic: boolean,
): Promise<SectionVisibility> {
  if ((PROFILE_SECTIONS as readonly string[]).includes(section)) {
    await db.userSectionVisibility
      .upsert({
        where: { userId_section: { userId, section } },
        update: { public: isPublic },
        create: { userId, section, public: isPublic },
      })
      .catch((err) => console.error("setSectionVisibility failed", err));
  }
  return getSectionVisibility(userId);
}

// A person's "thinking fingerprint" input: how their contributions spread across
// the five dimensions, ranked, only those with real activity.
export async function getThinkingDimensions(userId: string): Promise<DimSlice[]> {
  const contribs = await db.contribution
    .findMany({ where: { authorId: userId, deletedAt: null }, select: { dimension: true }, take: 5000 })
    .catch(() => [] as { dimension: string }[]);
  const counts: Record<string, number> = {};
  for (const c of contribs as { dimension: string }[]) counts[c.dimension] = (counts[c.dimension] ?? 0) + 1;
  const total = contribs.length;
  return DIMENSIONS.map((d) => ({
    key: d.key,
    label: d.label,
    emoji: d.emoji,
    color: d.color,
    count: counts[d.key] ?? 0,
    pct: total > 0 ? Math.round(((counts[d.key] ?? 0) / total) * 100) : 0,
  }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
}

export type InvolvedSeed = { id: string; title: string; garden: { name: string; emoji: string } };

// The PUBLIC seeds a person is involved in (created or contributed to) — safe to
// show on a profile because they're already world-visible. Never includes
// private seeds. Most recent first, capped.
export async function getInvolvedPublicSeeds(userId: string, cap = 10): Promise<InvolvedSeed[]> {
  const [created, contributed] = await Promise.all([
    db.seed.findMany({
      where: { createdById: userId, deletedAt: null, visibility: "public" },
      select: { id: true, title: true, createdAt: true, garden: { select: { name: true, emoji: true } } },
      orderBy: { createdAt: "desc" },
      take: cap,
    }),
    db.contribution.findMany({
      where: { authorId: userId, deletedAt: null, seed: { visibility: "public", deletedAt: null } },
      distinct: ["seedId"],
      select: { seed: { select: { id: true, title: true, garden: { select: { name: true, emoji: true } } } } },
      take: cap,
    }),
  ]);
  const seen = new Set<string>();
  const out: InvolvedSeed[] = [];
  for (const s of created as { id: string; title: string; garden: { name: string; emoji: string } }[]) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ id: s.id, title: s.title, garden: s.garden });
  }
  for (const c of contributed as { seed: { id: string; title: string; garden: { name: string; emoji: string } } | null }[]) {
    const s = c.seed;
    if (!s || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ id: s.id, title: s.title, garden: s.garden });
  }
  return out.slice(0, cap);
}

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
export async function ensureUserTopics(userId: string, hasActivity: boolean): Promise<string[]> {
  const existing = await getUserTopics(userId);
  if (existing.length > 0 || !hasActivity) return existing;
  return refreshUserTopics(userId);
}

// ── "How you show up" reflection ──────────────────────────────────────────

// A person's own recent messages (most recent first), with the seed title and
// dimension for context — the material Claude reads to mirror how they engage.
async function personMessages(userId: string, cap = 60): Promise<PersonMessage[]> {
  const rows = await db.contribution.findMany({
    where: { authorId: userId, deletedAt: null },
    select: { dimension: true, content: true, seed: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: cap,
  });
  return (rows as { dimension: string; content: unknown; seed: { title: string | null } | null }[])
    .map((r) => ({
      seedTitle: r.seed?.title ?? "a discussion",
      dimension: r.dimension,
      text: ((r.content as { text?: string } | null)?.text ?? "").trim(),
    }))
    .filter((m) => m.text.length > 0);
}

// Read the person's stored reflection ("" if none / table not migrated yet).
export async function getUserReflection(userId: string): Promise<string> {
  const row = await db.userReflection
    .findUnique({ where: { userId }, select: { summary: true } })
    .catch(() => null);
  return row?.summary ?? "";
}

// Regenerate the reflection from the person's latest messages and store it.
// Best-effort: on any AI/DB failure it leaves what's there and returns it.
export async function refreshUserReflection(userId: string): Promise<string> {
  try {
    const [user, messages] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { name: true } }),
      personMessages(userId),
    ]);
    const summary = await describeContributionStyle(user?.name ?? "This person", messages);
    if (summary) {
      await db.userReflection.upsert({
        where: { userId },
        update: { summary },
        create: { userId, summary },
      });
      return summary;
    }
  } catch (err) {
    console.error("refreshUserReflection failed", err);
  }
  return getUserReflection(userId);
}

// Save a person's own edited reflection (points, one per line). Trimming it to
// empty removes it — a subsequent view will lazily regenerate a fresh one.
export async function setUserReflection(userId: string, text: string): Promise<string> {
  const cleaned = parseReflectionPoints(text || "", 8);
  try {
    if (!cleaned) {
      await db.userReflection.deleteMany({ where: { userId } });
      return "";
    }
    await db.userReflection.upsert({
      where: { userId },
      update: { summary: cleaned },
      create: { userId, summary: cleaned },
    });
  } catch (err) {
    console.error("setUserReflection failed", err);
  }
  return cleaned;
}

// Read the reflection; if there's none yet but the person has written enough,
// generate it once (lazily) so a first visit isn't empty. Also upgrades a legacy
// single-paragraph reflection into readable points in place (no AI call).
export async function ensureUserReflection(userId: string, contributions: number): Promise<string> {
  const existing = await getUserReflection(userId);
  if (existing) {
    const pointed = parseReflectionPoints(existing, 8);
    if (pointed && pointed !== existing) {
      await db.userReflection
        .update({ where: { userId }, data: { summary: pointed } })
        .catch(() => {});
      return pointed;
    }
    return existing;
  }
  if (contributions < 3) return "";
  return refreshUserReflection(userId);
}

// How many times a person has tagged each AI, shown on their profile. Reads the
// ai_tag_events log. Resilient to the table not being migrated yet.
export async function getAiTagCounts(userId: string): Promise<{ claude: number; chatgpt: number }> {
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
//
// Per-section privacy: when `viewerId` isn't the profile's owner, sections the
// person has marked private are stripped from the payload entirely (not just
// hidden in the UI) so nothing private is even sent. The owner sees everything,
// plus the `visibility` map to drive their toggles.
export async function getPublicProfile(userId: string, viewerId?: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, bio: true, createdAt: true, deletedAt: true },
  });
  if (!user || user.deletedAt || user.name === "Claude" || user.name === "ChatGPT") return null;

  const isOwner = viewerId === userId;

  // One parallel batch. `dimensions` and `follow` only need userId/viewerId
  // (known up front), so they join the batch instead of running as two extra
  // sequential round-trips after it.
  const [
    contributions,
    seedsPlanted,
    bloomsHelped,
    recognitions,
    aiTags,
    visibility,
    involvedSeeds,
    dimensions,
    follow,
  ] = await Promise.all([
    db.contribution.count({ where: { authorId: userId, deletedAt: null } }),
    db.seed.count({ where: { createdById: userId, deletedAt: null } }),
    db.seed.count({ where: { createdById: userId, deletedAt: null, bloomId: { not: null } } }),
    db.userRecognition
      .findMany({ where: { userId }, include: { label: true } })
      .catch(() => [] as { labelKey: string; label: { emoji: string | null; label: string | null } | null }[]),
    getAiTagCounts(userId),
    getSectionVisibility(userId),
    getInvolvedPublicSeeds(userId).catch(() => [] as InvolvedSeed[]),
    getThinkingDimensions(userId).catch(() => [] as DimSlice[]),
    getFollowContext(userId, viewerId).catch(() => ({
      followers: 0,
      following: 0,
      isFollowing: false,
    })),
  ]);

  // Only the owner's own view lazily generates topics/reflection (an AI call);
  // everyone else just reads what's stored, so a stranger opening a shared link
  // never drives generation.
  const [topics, reflection] = await Promise.all([
    (isOwner
      ? ensureUserTopics(userId, contributions > 0 || seedsPlanted > 0)
      : getUserTopics(userId)
    ).catch(() => [] as string[]),
    (isOwner ? ensureUserReflection(userId, contributions) : getUserReflection(userId)).catch(
      () => "",
    ),
  ]);

  // Aggregate recognitions by label (across gardens) — count, not garden names.
  const byLabel = new Map<string, { emoji: string; label: string; count: number }>();
  for (const r of recognitions as { labelKey: string; label: { emoji: string | null; label: string | null } | null }[]) {
    const cur =
      byLabel.get(r.labelKey) ?? { emoji: r.label?.emoji ?? "✦", label: r.label?.label ?? r.labelKey, count: 0 };
    cur.count += 1;
    byLabel.set(r.labelKey, cur);
  }

  // Strip sections a non-owner isn't allowed to see, so private data never even
  // reaches their client. The owner keeps everything.
  const canSee = (s: ProfileSection) => isOwner || visibility[s];

  return {
    id: user.id,
    name: displayName(user),
    image: user.image,
    bio: user.bio,
    isOwner,
    follow,
    joinedAt: user.createdAt.toISOString(),
    stats: { contributions, seedsPlanted, bloomsHelped },
    visibility,
    aiTags: canSee("aiTags") ? aiTags : null,
    reflection: canSee("reflection") ? reflection : "",
    topics: canSee("topics") ? topics : [],
    involvedSeeds: canSee("seeds") ? involvedSeeds : [],
    dimensions: canSee("fingerprint") ? dimensions : [],
    recognitions: [...byLabel.values()].sort((a, b) => b.count - a.count),
  };
}
