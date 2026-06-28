import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import {
  ensureSeedParticipant,
  requireSeedAccess,
  requireGardenSteward,
} from "@/lib/authz";
import {
  claudeReply,
  chatgptReply,
  classifyDimension,
  mediate,
  openaiMediate,
  aiStageVote,
  summarizeThread,
  mentionsClaude,
  type ContribForAI,
} from "@/lib/ai";
import { extractMentionIds } from "@/lib/mentions";
import { requestAdmissionIfNeeded } from "@/lib/services/stake";
import { settleStage } from "@/lib/services/voting";
import { STAGES } from "@/lib/constants";
import { deliver } from "@/lib/services/notify";
import { getReactionTypes } from "@/lib/registry";

async function seedOrThrow(seedId: string) {
  const seed = await db.seed.findUnique({ where: { id: seedId } });
  if (!seed || seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");
  return seed;
}

const CLAUDE_EMAIL = "claude@thinkthru.app";
const CHATGPT_EMAIL = "chatgpt@thinkthru.app";

// Claude is a permanent participant: one shared system user that authors its
// replies. Created lazily the first time someone tags @claude.
async function getOrCreateClaudeUser() {
  return db.user.upsert({
    where: { email: CLAUDE_EMAIL },
    update: {},
    create: { email: CLAUDE_EMAIL, name: "Claude" },
    select: { id: true, name: true, image: true },
  });
}

// ChatGPT is a second permanent AI participant, created lazily on first @chatgpt.
async function getOrCreateChatGptUser() {
  return db.user.upsert({
    where: { email: CHATGPT_EMAIL },
    update: {},
    create: { email: CHATGPT_EMAIL, name: "ChatGPT" },
    select: { id: true, name: true, image: true },
  });
}

// Build the thread (with images) an AI participant sees for this seed.
async function threadForSeed(seedId: string) {
  const seed = await db.seed.findUnique({
    where: { id: seedId },
    include: {
      contributions: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!seed) return null;
  const thread: ContribForAI[] = seed.contributions.map((c) => {
    const content = c.content as
      | { text?: string; attachments?: { url: string; type: string }[] }
      | null;
    const images = (content?.attachments ?? [])
      .filter((a) => a.type === "image")
      .map((a) => a.url);
    return {
      dimension: c.dimension,
      author: c.author.name || "A member",
      text: content?.text ?? "",
      images: images.length ? images : undefined,
    };
  });
  return { seed, thread };
}

// ChatGPT's reply to an @chatgpt mention, posted as the ChatGPT system user.
export async function respondAsChatGpt(
  seedId: string,
  dimension: string,
  mentionText: string,
  parentId: string,
) {
  const data = await threadForSeed(seedId);
  if (!data) return null;
  const reply = await chatgptReply({
    title: data.seed.title,
    content: data.seed.content,
    dimension,
    mention: mentionText,
    contributions: data.thread,
  });
  if (!reply) return null;

  const bot = await getOrCreateChatGptUser();
  return db.contribution.create({
    data: { seedId, authorId: bot.id, dimension, parentId, content: { text: reply } },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
}

// When a contribution tags @claude, generate Claude's reply and post it as a
// contribution authored by the Claude system user (threaded under the mention).
// Returns the new contribution DTO, or null if AI is off / the call failed.
export async function respondAsClaude(
  seedId: string,
  dimension: string,
  mentionText: string,
  parentId: string,
) {
  const seed = await db.seed.findUnique({
    where: { id: seedId },
    include: {
      contributions: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!seed) return null;

  const thread: ContribForAI[] = seed.contributions.map((c) => {
    const content = c.content as
      | { text?: string; attachments?: { url: string; type: string }[] }
      | null;
    const images = (content?.attachments ?? [])
      .filter((a) => a.type === "image")
      .map((a) => a.url);
    return {
      dimension: c.dimension,
      author: c.author.name || "A member",
      text: content?.text ?? "",
      images: images.length ? images : undefined,
    };
  });

  const reply = await claudeReply({
    title: seed.title,
    content: seed.content,
    dimension,
    mention: mentionText,
    contributions: thread,
  });
  if (!reply) return null;

  const claude = await getOrCreateClaudeUser();
  const contribution = await db.contribution.create({
    data: {
      seedId,
      authorId: claude.id,
      dimension,
      parentId,
      content: { text: reply },
    },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
  return contribution;
}

// Ask an AI to join the quorum: it reads the thread, posts its read as a short
// contribution, and casts a real stage vote — which counts in "Community feels"
// and toward the bloom quorum (headcount path), exactly like a person's. A human
// must invoke it (they're the one with seed access). Returns null if the
// provider isn't configured.
export async function aiVoteOnSeed(
  invokerId: string,
  seedId: string,
  provider: "claude" | "chatgpt",
) {
  const seed = await db.seed.findUnique({
    where: { id: seedId },
    select: { stage: true, bloomId: true, deletedAt: true },
  });
  if (!seed || seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");
  if (seed.stage === "bloomed" && seed.bloomId) {
    throw new ApiError("CONFLICT", "This seed has already bloomed");
  }
  await requireSeedAccess(invokerId, seedId);

  const data = await threadForSeed(seedId);
  if (!data) throw new ApiError("NOT_FOUND", "Seed not found");

  const decision = await aiStageVote(provider, {
    title: data.seed.title,
    content: data.seed.content,
    contributions: data.thread,
  });
  if (!decision) return null;

  const bot = provider === "chatgpt" ? await getOrCreateChatGptUser() : await getOrCreateClaudeUser();
  const stageMeta = STAGES.find((s) => s.key === decision.stage) ?? STAGES[0];

  // Post the rationale (becomes a participant) and cast the vote (counts).
  const contribution = await db.contribution.create({
    data: {
      seedId,
      authorId: bot.id,
      dimension: decision.stage === "bloomed" ? "bloom" : "debate",
      content: { text: `🗳️ I'd call this **${stageMeta.emoji} ${stageMeta.label}** — ${decision.note}` },
    },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
  await db.seedStageVote.upsert({
    where: { seedId_userId: { seedId, userId: bot.id } },
    update: { stage: decision.stage, votedAt: new Date() },
    create: { seedId, userId: bot.id, stage: decision.stage },
  });

  // Settle the consequences (display stage + maybe bloom), attributed to the
  // human who asked, since they hold seed access for createBloom.
  const result = await settleStage(seedId, invokerId);
  return { contribution, result };
}

// Ask Claude or ChatGPT to summarize the whole discussion, organised by
// dimension. Read-only — nothing is posted to the thread. Returns the summary
// text, or null if that provider isn't configured.
export async function summarizeSeed(
  userId: string,
  seedId: string,
  provider: "claude" | "chatgpt" = "claude",
): Promise<string | null> {
  await requireSeedAccess(userId, seedId);
  const data = await threadForSeed(seedId);
  if (!data) throw new ApiError("NOT_FOUND", "Seed not found");
  return summarizeThread(provider, {
    title: data.seed.title,
    content: data.seed.content,
    contributions: data.thread,
  });
}

// Ask Claude or ChatGPT to mediate the seed's discussion. Posts the mediation as
// a contribution by that AI's system user in the Debate dimension. Requires seed
// access; returns the new contribution, or null if AI is off / failed.
export async function mediateSeed(
  userId: string,
  seedId: string,
  provider: "claude" | "chatgpt" = "claude",
) {
  await requireSeedAccess(userId, seedId);
  const [seed, reactionTypes] = await Promise.all([
    db.seed.findUnique({
      where: { id: seedId },
      include: {
        contributions: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { name: true } },
            reactions: { select: { reactionKey: true } },
          },
        },
      },
    }),
    getReactionTypes(),
  ]);
  if (!seed) throw new ApiError("NOT_FOUND", "Seed not found");

  const rmap = new Map(reactionTypes.map((r) => [r.key, r]));
  const thread: ContribForAI[] = seed.contributions.map((c) => {
    const counts: Record<string, number> = {};
    for (const r of c.reactions) counts[r.reactionKey] = (counts[r.reactionKey] ?? 0) + 1;
    const reactions = Object.entries(counts)
      .map(([k, n]) => {
        const t = rmap.get(k);
        return `${t?.emoji ?? ""} ${t?.label ?? k} ×${n}`;
      })
      .join(", ");
    const content = c.content as
      | { text?: string; attachments?: { url: string; type: string }[] }
      | null;
    const images = (content?.attachments ?? [])
      .filter((a) => a.type === "image")
      .map((a) => a.url);
    return {
      dimension: c.dimension,
      author: c.author.name || "A member",
      text: content?.text ?? "",
      reactions: reactions || undefined,
      images: images.length ? images : undefined,
    };
  });

  const text = await (provider === "chatgpt"
    ? openaiMediate({ title: seed.title, content: seed.content, contributions: thread })
    : mediate({ title: seed.title, content: seed.content, contributions: thread }));
  if (!text) return null;

  const bot =
    provider === "chatgpt" ? await getOrCreateChatGptUser() : await getOrCreateClaudeUser();
  const contribution = await db.contribution.create({
    data: {
      seedId,
      authorId: bot.id,
      dimension: "debate",
      content: { text: `🕊️ **Mediation**\n\n${text}` },
    },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
  return contribution;
}

type Attachment = { url: string; type: "image" | "video" | "file"; name?: string };

export async function addContribution(
  userId: string,
  seedId: string,
  input: { dimension: string; text: string; parentId?: string; attachments?: Attachment[] },
) {
  const seed = await seedOrThrow(seedId);
  await ensureSeedParticipant(userId, seedId);

  const attachments = input.attachments ?? [];
  const contribution = await db.contribution.create({
    data: {
      seedId,
      authorId: userId,
      dimension: input.dimension,
      parentId: input.parentId ?? null,
      contentType: attachments.length > 0 ? attachments[0].type : "text",
      content: { text: input.text, attachments },
    },
    include: { author: { select: { id: true, name: true, image: true } } },
  });

  const snippet = previewSnippet(input.text);

  // Notify the seed's author (unless they're the contributor) — with a taste of
  // the message and a link straight to it.
  if (seed.createdById !== userId) {
    await db.notification.create({
      data: {
        recipientId: seed.createdById,
        actorId: userId,
        type: "contribution",
        title: "New contribution on your seed",
        body: snippet ? `“${snippet}” · ${seed.title}` : seed.title,
        entityType: "seed",
        entityId: seedId,
        anchorId: contribution.id,
      },
    });
  }

  // Notify anyone @-mentioned (in-app + email), as long as they can see the seed.
  await notifyMentions(userId, seed, input.text, contribution.id, snippet);

  // If the decision quorum is locked and this is a newcomer, open an admission
  // request so the carriers can vote them in. Never blocks the contribution.
  await requestAdmissionIfNeeded(seedId, userId);

  return contribution;
}

// A readable, truncated preview of a message: turns @[Name](uuid) tokens into
// "@Name", collapses whitespace, and caps the length. Used so notifications
// carry a taste of what was said instead of a bare title.
function previewSnippet(text: string, max = 120): string {
  const clean = text
    .replace(/@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)/g, "@$1")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

// Create "mention" notifications (and emails) for everyone tagged in the text,
// filtered to users who can actually access the seed. Never notifies the author
// of their own mention. Failures here never block the contribution.
async function notifyMentions(
  actorId: string,
  seed: { id: string; gardenId: string; title: string; visibility: string },
  text: string,
  contributionId: string,
  snippet: string,
) {
  try {
    const ids = extractMentionIds(text).filter((id) => id !== actorId);
    if (ids.length === 0) return;

    // Keep only ids that can see this seed (seed members for a private seed,
    // garden members otherwise).
    const allowed =
      seed.visibility === "private"
        ? await db.seedMember.findMany({
            where: { seedId: seed.id, userId: { in: ids } },
            select: { userId: true },
          })
        : await db.gardenMember.findMany({
            where: { gardenId: seed.gardenId, userId: { in: ids } },
            select: { userId: true },
          });
    const recipientIds = allowed.map((r) => r.userId);
    if (recipientIds.length === 0) return;

    const actor = await db.user.findUnique({ where: { id: actorId }, select: { name: true } });
    const actorName = actor?.name || "Someone";

    // Create one row per recipient (not createMany) so we get their ids back
    // and can stamp delivery on each.
    const rows = await Promise.all(
      recipientIds.map((rid) =>
        db.notification.create({
          data: {
            recipientId: rid,
            actorId,
            type: "mention",
            title: `${actorName} mentioned you`,
            body: snippet ? `“${snippet}” · in ${seed.title}` : `in ${seed.title}`,
            entityType: "seed",
            entityId: seed.id,
            anchorId: contributionId,
          },
          select: { id: true, recipientId: true },
        }),
      ),
    );

    // Fan out to email + push (deliver respects each person's preferences). The
    // link jumps to the exact message; push/email carry the preview snippet.
    await deliver(
      rows.map((r) => ({
        notificationId: r.id,
        recipientId: r.recipientId,
        type: "mention",
        push: { title: `${actorName} mentioned you`, body: snippet || seed.title },
        link: `/seeds/${seed.id}#c-${contributionId}`,
        email: { kind: "mention", seedTitle: seed.title, actorName, snippet },
      })),
    );
  } catch (err) {
    console.error("notifyMentions failed", err);
  }
}

// Auto-classify a contribution's dimension with Claude (called right after the
// message is posted, so the badge fills in). Returns the resolved dimension.
export async function classifyContribution(userId: string, contributionId: string) {
  const c = await db.contribution.findUnique({
    where: { id: contributionId },
    include: { seed: { select: { title: true, content: true } } },
  });
  if (!c || c.deletedAt) throw new ApiError("NOT_FOUND", "Contribution not found");
  await requireSeedAccess(userId, c.seedId);

  const text = (c.content as { text?: string } | null)?.text ?? "";
  const dim = await classifyDimension({
    title: c.seed.title,
    content: c.seed.content,
    text,
  });
  if (!dim || dim === c.dimension) return { dimension: c.dimension };

  await db.contribution.update({ where: { id: contributionId }, data: { dimension: dim } });
  return { dimension: dim };
}

// Manually re-tag a contribution's dimension (when Claude got it wrong).
export async function retagContribution(
  userId: string,
  contributionId: string,
  dimension: string,
) {
  const c = await db.contribution.findUnique({ where: { id: contributionId } });
  if (!c || c.deletedAt) throw new ApiError("NOT_FOUND", "Contribution not found");
  await requireSeedAccess(userId, c.seedId);
  await db.contribution.update({ where: { id: contributionId }, data: { dimension } });
  return { dimension };
}

// Toggle a reaction on/off for the current user; returns updated counts.
export async function toggleReaction(
  userId: string,
  contributionId: string,
  reactionKey: string,
) {
  const contribution = await db.contribution.findUnique({
    where: { id: contributionId },
    include: { seed: true },
  });
  if (!contribution || contribution.deletedAt) {
    throw new ApiError("NOT_FOUND", "Contribution not found");
  }
  await requireSeedAccess(userId, contribution.seedId);

  const reactionType = await db.reactionType.findUnique({
    where: { key: reactionKey },
  });
  if (!reactionType || !reactionType.isActive) {
    throw new ApiError("BAD_REQUEST", "Unknown reaction");
  }

  const existing = await db.contributionReaction.findUnique({
    where: {
      contributionId_userId_reactionKey: { contributionId, userId, reactionKey },
    },
  });
  if (existing) {
    await db.contributionReaction.delete({
      where: {
        contributionId_userId_reactionKey: { contributionId, userId, reactionKey },
      },
    });
  } else {
    await db.contributionReaction.create({
      data: { contributionId, userId, reactionKey },
    });
  }

  const rows = await db.contributionReaction.groupBy({
    by: ["reactionKey"],
    where: { contributionId },
    _count: { reactionKey: true },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.reactionKey] = r._count.reactionKey;
  return { reacted: !existing, counts };
}

// Edit a contribution's text — author only.
export async function editContribution(userId: string, contributionId: string, text: string) {
  const c = await db.contribution.findUnique({ where: { id: contributionId } });
  if (!c || c.deletedAt) throw new ApiError("NOT_FOUND", "Contribution not found");
  if (c.authorId !== userId) throw new ApiError("FORBIDDEN", "You can only edit your own contributions");
  await db.contribution.update({
    where: { id: contributionId },
    data: { content: { text } },
  });
  return { id: contributionId, text };
}

// Soft-delete a contribution — author or a garden steward.
export async function deleteContribution(userId: string, contributionId: string) {
  const c = await db.contribution.findUnique({
    where: { id: contributionId },
    include: { seed: true },
  });
  if (!c || c.deletedAt) throw new ApiError("NOT_FOUND", "Contribution not found");
  // The author can always delete their own. For a public seed a garden steward
  // can moderate; private seeds aren't visible to garden stewards, so there
  // requireSeedAccess throws unless the steward is actually a seed member.
  if (c.authorId !== userId) {
    await requireSeedAccess(userId, c.seedId);
    if (c.seed.visibility !== "private") {
      await requireGardenSteward(userId, c.seed.gardenId);
    } else {
      throw new ApiError("FORBIDDEN", "Only the author can delete this");
    }
  } else {
    await requireSeedAccess(userId, c.seedId);
  }
  await db.contribution.update({
    where: { id: contributionId },
    data: { deletedAt: new Date() },
  });
  return { id: contributionId, deleted: true };
}

// Toggle an endorsement on a contribution (recognizing the contributor's role,
// distinct from a reaction). Notifies the author the first time.
export async function toggleEndorsement(userId: string, contributionId: string) {
  const contribution = await db.contribution.findUnique({
    where: { id: contributionId },
    include: { seed: true },
  });
  if (!contribution || contribution.deletedAt) {
    throw new ApiError("NOT_FOUND", "Contribution not found");
  }
  await requireSeedAccess(userId, contribution.seedId);

  const existing = await db.contributionEndorsement.findUnique({
    where: { contributionId_endorserId: { contributionId, endorserId: userId } },
  });
  if (existing) {
    await db.contributionEndorsement.delete({
      where: { contributionId_endorserId: { contributionId, endorserId: userId } },
    });
  } else {
    await db.contributionEndorsement.create({
      data: { contributionId, endorserId: userId },
    });
    if (contribution.authorId !== userId) {
      // An impact moment: name the person and echo the point, so it reads as
      // "you were understood," not a bare like.
      const endorser = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
      const endorserName = endorser?.name || "Someone";
      const text = ((contribution.content as { text?: string } | null)?.text ?? "").trim();
      const snippet = text.slice(0, 90);
      const note = await db.notification.create({
        data: {
          recipientId: contribution.authorId,
          actorId: userId,
          type: "endorsement",
          title: `${endorserName} found your point valuable ✦`,
          body: snippet
            ? `“${snippet}${text.length > 90 ? "…" : ""}” · in ${contribution.seed.title}`
            : `in ${contribution.seed.title}`,
          entityType: "seed",
          entityId: contribution.seedId,
        },
        select: { id: true },
      });
      await deliver([
        {
          notificationId: note.id,
          recipientId: contribution.authorId,
          type: "endorsement",
          push: {
            title: `${endorserName} found your point valuable ✦`,
            body: contribution.seed.title,
          },
          link: `/seeds/${contribution.seedId}`,
          email: {
            kind: "endorsement",
            seedTitle: contribution.seed.title,
            actorName: endorserName,
            snippet,
          },
        },
      ]);
    }
  }
  const count = await db.contributionEndorsement.count({ where: { contributionId } });
  return { endorsed: !existing, count };
}
