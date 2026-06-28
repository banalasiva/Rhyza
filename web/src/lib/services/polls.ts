import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireSeedAccess, ensureSeedParticipant } from "@/lib/authz";
import { getStakeWeightMap } from "@/lib/services/stake";

// Create a poll inside a seed. weightMode "equal" → one person one vote;
// "stake" → each vote counts by the voter's bloom (decision-maker) weight.
export async function createPoll(
  userId: string,
  seedId: string,
  input: { question: string; options: string[]; weightMode: "equal" | "stake" },
) {
  await ensureSeedParticipant(userId, seedId);
  const poll = await db.poll.create({
    data: {
      seedId,
      authorId: userId,
      question: input.question.trim(),
      weightMode: input.weightMode,
      options: {
        create: input.options.map((text, i) => ({ text: text.trim(), sortOrder: i })),
      },
    },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  return poll;
}

// Cast (or change) my vote on a poll — single choice.
export async function votePoll(userId: string, pollId: string, optionId: string) {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    include: { options: { select: { id: true } } },
  });
  if (!poll) throw new ApiError("NOT_FOUND", "Poll not found");
  if (poll.closedAt) throw new ApiError("CONFLICT", "This poll is closed");
  await ensureSeedParticipant(userId, poll.seedId);
  if (!poll.options.some((o) => o.id === optionId)) {
    throw new ApiError("BAD_REQUEST", "Unknown option");
  }
  await db.pollVote.upsert({
    where: { pollId_userId: { pollId, userId } },
    update: { optionId, votedAt: new Date() },
    create: { pollId, userId, optionId },
  });
  return listPolls(userId, poll.seedId);
}

// Close / reopen / delete — author only.
export async function setPollClosed(userId: string, pollId: string, closed: boolean) {
  const poll = await db.poll.findUnique({ where: { id: pollId } });
  if (!poll) throw new ApiError("NOT_FOUND", "Poll not found");
  if (poll.authorId !== userId) throw new ApiError("FORBIDDEN", "Only the poll's author can do that");
  await db.poll.update({ where: { id: pollId }, data: { closedAt: closed ? new Date() : null } });
  return listPolls(userId, poll.seedId);
}

export async function deletePoll(userId: string, pollId: string) {
  const poll = await db.poll.findUnique({ where: { id: pollId } });
  if (!poll) throw new ApiError("NOT_FOUND", "Poll not found");
  if (poll.authorId !== userId) throw new ApiError("FORBIDDEN", "Only the poll's author can do that");
  await db.poll.delete({ where: { id: pollId } });
  return listPolls(userId, poll.seedId);
}

// All polls in a seed with computed results. Stake-weighted polls reuse the
// exact bloom weights; if no stake map exists yet they fall back to equal.
export async function listPolls(userId: string, seedId: string) {
  await requireSeedAccess(userId, seedId);
  const [polls, weightMap] = await Promise.all([
    db.poll.findMany({
      where: { seedId },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, image: true } },
        options: { orderBy: { sortOrder: "asc" } },
        votes: { select: { userId: true, optionId: true } },
      },
    }),
    getStakeWeightMap(seedId),
  ]);
  const hasWeights = Object.keys(weightMap).length > 0;

  return polls.map((poll) => {
    const stakeMode = poll.weightMode === "stake" && hasWeights;
    // Weight per vote: equal → 1; stake → voter's weight (fallback 0).
    const weightOf = (uid: string) => (stakeMode ? weightMap[uid] ?? 0 : 1);
    let totalWeight = 0;
    const perOption: Record<string, number> = {};
    for (const v of poll.votes) {
      const w = weightOf(v.userId);
      perOption[v.optionId] = (perOption[v.optionId] ?? 0) + w;
      totalWeight += w;
    }
    const myVote = poll.votes.find((v) => v.userId === userId)?.optionId ?? null;
    return {
      id: poll.id,
      question: poll.question,
      weightMode: poll.weightMode as "equal" | "stake",
      stakeActive: stakeMode,
      closed: !!poll.closedAt,
      isAuthor: poll.authorId === userId,
      author: poll.author,
      myVote,
      totalVotes: poll.votes.length,
      createdAt: poll.createdAt.toISOString(),
      options: poll.options.map((o) => {
        const weight = perOption[o.id] ?? 0;
        const votes = poll.votes.filter((v) => v.optionId === o.id).length;
        return {
          id: o.id,
          text: o.text,
          votes,
          pct: totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0,
        };
      }),
    };
  });
}
