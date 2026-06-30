import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { enforceAiRateLimit } from "@/lib/ratelimit";
import { createContributionSchema } from "@/lib/validation";
import {
  addContribution,
  listContributions,
  respondAsClaude,
  respondAsChatGpt,
} from "@/lib/services/contributions";
import { aiConfigured, openaiConfigured, mentionsClaude, mentionsChatGpt } from "@/lib/ai";

function toDTO(c: {
  id: string;
  dimension: string;
  content: unknown;
  parentId: string | null;
  author: { id: string; name: string; image: string | null };
  createdAt: Date;
}) {
  const content = c.content as {
    text?: string;
    attachments?: { url: string; type: "image" | "video" | "file"; name?: string }[];
  };
  return {
    id: c.id,
    dimension: c.dimension,
    text: content.text ?? "",
    attachments: content.attachments ?? [],
    parentId: c.parentId,
    author: c.author,
    createdAt: c.createdAt.toISOString(),
  };
}

// GET /api/seeds/:id/contributions?since=<iso> — the thread, or just the
// messages newer than `since`. Powers live polling so everyone sees new
// contributions appear without a manual refresh.
export const GET = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const sinceRaw = new URL(req.url).searchParams.get("since");
  const since = sinceRaw ? new Date(sinceRaw) : undefined;
  const valid = since && !Number.isNaN(since.getTime()) ? since : undefined;
  const rows = await listContributions(userId, ctx.params.id, valid);
  return ok({ contributions: rows.map(toDTO) });
});

// POST /api/seeds/:id/contributions — add a contribution in a dimension.
// If it tags @claude, Claude replies inline (returned as `aiReply`).
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = createContributionSchema.parse(await req.json());
  const c = await addContribution(userId, ctx.params.id, body);

  // @claude and/or @chatgpt can both be tagged in one message — each replies.
  const aiReplies: ReturnType<typeof toDTO>[] = [];
  // "not_configured" = no key; otherwise a clean, generic message (we never
  // surface raw provider error strings to the client — those are logged).
  let aiError: string | null = null;

  const wantsClaude = mentionsClaude(body.text);
  const wantsChatGpt = mentionsChatGpt(body.text);
  // Tagging an AI triggers a paid completion — count it against the AI budget.
  if (wantsClaude || wantsChatGpt) await enforceAiRateLimit(userId);

  if (wantsClaude) {
    if (!aiConfigured()) aiError = "not_configured";
    else {
      try {
        const reply = await respondAsClaude(ctx.params.id, body.dimension, body.text, c.id);
        if (reply) aiReplies.push(toDTO(reply));
        else aiError = aiError ?? "Claude couldn't reply just now.";
      } catch (err) {
        console.error("[ai] claude reply failed", err);
        aiError = aiError ?? "Claude couldn't reply just now.";
      }
    }
  }

  if (wantsChatGpt) {
    if (!openaiConfigured()) aiError = aiError ?? "not_configured";
    else {
      try {
        const reply = await respondAsChatGpt(ctx.params.id, body.dimension, body.text, c.id);
        if (reply) aiReplies.push(toDTO(reply));
        else aiError = aiError ?? "ChatGPT couldn't reply just now.";
      } catch (err) {
        console.error("[ai] chatgpt reply failed", err);
        aiError = aiError ?? "ChatGPT couldn't reply just now.";
      }
    }
  }

  return ok({ ...toDTO(c), aiReplies, aiError }, 201);
});
