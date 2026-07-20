import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { db } from "@/lib/db";
import { enforceAiRateLimit } from "@/lib/ratelimit";
import { createContributionSchema } from "@/lib/validation";
import {
  addContribution,
  listContributions,
  respondAsClaude,
  respondAsChatGpt,
} from "@/lib/services/contributions";
import { aiConfigured, openaiConfigured, mentionsClaude, mentionsChatGpt } from "@/lib/ai";
import { seedAiEnabled } from "@/lib/services/ai-settings";
import { isGuestUser } from "@/lib/guest";

// Posting can trigger an inline AI reply, and high-quality gpt-image-1 edits
// (input_fidelity "high") can take 1–2 min. 300s is the Vercel Pro ceiling —
// enough headroom for the slowest edit so the request finishes instead of being
// killed mid-generation. (The OpenAI SDK image calls cap at 240s/180s, inside
// this.) NOTE: 300 requires the Pro plan; on Hobby the build caps at 60.
export const maxDuration = 300;

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

  // AI helpers can be switched off per seed by its owner/admin — then a stray
  // @claude/@chatgpt is just left as plain text, no reply, no charge.
  const aiOn = await seedAiEnabled(ctx.params.id);
  // Guests never trigger a paid AI completion. If a guest tags an AI, the post
  // still lands as plain text; we return the "guest_ai" signal so the client can
  // nudge them to create a free account (the build-trust-then-ask-for-email loop).
  const guest = await isGuestUser(userId);
  const taggedAi = mentionsClaude(body.text) || mentionsChatGpt(body.text);
  if (guest && taggedAi) aiError = "guest_ai";
  const wantsClaude = aiOn && !guest && mentionsClaude(body.text);
  const wantsChatGpt = aiOn && !guest && mentionsChatGpt(body.text);
  // Tagging an AI triggers a paid completion — count it against the AI budget.
  if (wantsClaude || wantsChatGpt) await enforceAiRateLimit(userId);
  // Silent usage meter (for stats now, a free monthly quota later). Must never
  // block or fail a post.
  try {
    if (wantsClaude) await db.aiTagEvent.create({ data: { userId, provider: "claude" } });
    if (wantsChatGpt) await db.aiTagEvent.create({ data: { userId, provider: "chatgpt" } });
  } catch {
    /* metering is best-effort */
  }

  // Pull a short, non-secret reason out of a provider error (e.g.
  // "insufficient_quota", "model_not_found", "rate_limit_exceeded", "HTTP 401")
  // so a failed AI reply says WHY instead of a blank "couldn't reply".
  const reason = (err: unknown): string => {
    const e = err as {
      code?: string;
      type?: string;
      status?: number;
      message?: string;
      error?: { message?: string };
    };
    const label = e?.code || e?.type || (e?.status ? `HTTP ${e.status}` : "");
    // OpenAI/Anthropic put the actionable detail in the message ("Rate limit
    // reached … TPM: Limit 30000, Requested 45000", "You exceeded your quota",
    // "Request too large", etc.). Surface a trimmed version so we can see the
    // real cause, not just the code. No secrets live in these messages.
    const msg = (e?.error?.message || e?.message || "").replace(/\s+/g, " ").trim().slice(0, 220);
    return [label, msg].filter(Boolean).join(": ");
  };

  if (wantsClaude) {
    if (!aiConfigured()) aiError = "not_configured";
    else {
      try {
        const reply = await respondAsClaude(ctx.params.id, body.dimension, body.text, c.id, userId);
        if (reply) aiReplies.push(toDTO(reply));
        else aiError = aiError ?? "Claude couldn't reply just now.";
      } catch (err) {
        console.error("[ai] claude reply failed", err);
        const r = reason(err);
        aiError = aiError ?? (r ? `Claude couldn't reply (${r}).` : "Claude couldn't reply just now.");
      }
    }
  }

  if (wantsChatGpt) {
    if (!openaiConfigured()) aiError = aiError ?? "not_configured";
    else {
      try {
        const reply = await respondAsChatGpt(ctx.params.id, body.dimension, body.text, c.id, userId);
        if (reply) aiReplies.push(toDTO(reply));
        else aiError = aiError ?? "ChatGPT couldn't reply just now.";
      } catch (err) {
        console.error("[ai] chatgpt reply failed", err);
        const r = reason(err);
        aiError = aiError ?? (r ? `ChatGPT couldn't reply (${r}).` : "ChatGPT couldn't reply just now.");
      }
    }
  }

  return ok({ ...toDTO(c), aiReplies, aiError }, 201);
});
