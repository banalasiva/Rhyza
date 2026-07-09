import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getDailyQuestionState, answerDailyQuestion } from "@/lib/services/daily-question";

export const dynamic = "force-dynamic";

// GET /api/daily-question — today's question, this person's answer (if any),
// and the live tally.
export const GET = handle(async () => {
  const userId = await requireUserId();
  return ok(await getDailyQuestionState(userId));
});

const AnswerBody = z.object({ choice: z.number().int().min(0) });

// POST /api/daily-question { choice } — record/change today's answer, get the
// fresh tally back.
export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const { choice } = AnswerBody.parse(await req.json());
  return ok(await answerDailyQuestion(userId, choice));
});
