import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import {
  recognizeContribution,
  unrecognizeContribution,
  getContributionRecognition,
} from "@/lib/services/recognition";

// GET  /api/contributions/:id/recognize — this message's virtue counts + which
//      the viewer has given (fetched on demand when the action sheet opens).
// POST { virtue } — recognize the message's author for a virtue.
// DELETE { virtue } — take it back.

export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await getContributionRecognition(ctx.params.id, userId));
});

export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const { virtue } = (await req.json().catch(() => ({}))) as { virtue?: string };
  return ok(await recognizeContribution(userId, ctx.params.id, String(virtue ?? "")));
});

export const DELETE = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const { virtue } = (await req.json().catch(() => ({}))) as { virtue?: string };
  return ok(await unrecognizeContribution(userId, ctx.params.id, String(virtue ?? "")));
});
