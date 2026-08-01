import { requireUserId, requireSeedAccessLight } from "@/lib/authz";
import { db } from "@/lib/db";
import { enforceAiRateLimit } from "@/lib/ratelimit";
import { streamClaudeReply, streamChatGptReply } from "@/lib/services/contributions";
import { aiConfigured, openaiConfigured } from "@/lib/ai";
import { seedAiEnabled } from "@/lib/services/ai-settings";
import { isGuestUser } from "@/lib/guest";

// Streaming lives on the reply path; a slow (searched) reply must not be killed
// mid-stream. 300 is the Vercel Pro ceiling (Hobby caps at 60).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// The DTO the client swaps its streaming bubble for — same shape the
// contributions route returns.
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

// POST /api/seeds/:id/ai-reply — stream an @claude or @chatgpt reply to a
// message, token-by-token, as Server-Sent Events:
//   event: delta  data: { text }        — a chunk of the reply, as it's typed
//   event: done   data: { contribution } — the final persisted contribution
//   event: error  data: { message }      — generation failed
// The client shows a live-typing bubble from the deltas and replaces it with the
// real contribution on `done`.
export async function POST(req: Request, ctx: { params: { id: string } }): Promise<Response> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const seedId = ctx.params.id;
  const body = (await req.json()) as {
    provider?: string;
    parentId?: string;
    mentionText?: string;
    dimension?: string;
  };
  const provider = body.provider === "chatgpt" ? "chatgpt" : "claude";
  const parentId = String(body.parentId ?? "");
  const mentionText = String(body.mentionText ?? "");
  const dimension = String(body.dimension || "understanding");

  // Gate before streaming so failures come back as a clean JSON error, not a
  // half-open stream.
  await requireSeedAccessLight(userId, seedId);
  if (await isGuestUser(userId)) {
    return Response.json({ error: "guest_ai" }, { status: 200 });
  }
  if (!(await seedAiEnabled(seedId))) {
    return Response.json({ error: "ai_disabled" }, { status: 200 });
  }
  if (provider === "claude" ? !aiConfigured() : !openaiConfigured()) {
    return Response.json({ error: "not_configured" }, { status: 200 });
  }
  try {
    await enforceAiRateLimit(userId);
  } catch {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  // Silent usage meter — best-effort, must never block the reply.
  try {
    await db.aiTagEvent.create({ data: { userId, provider } });
  } catch {
    /* metering is best-effort */
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        const onDelta = (chunk: string) => send("delta", { text: chunk });
        const contribution =
          provider === "claude"
            ? await streamClaudeReply(seedId, dimension, mentionText, parentId, userId, onDelta)
            : await streamChatGptReply(seedId, dimension, mentionText, parentId, userId, onDelta);
        if (!contribution) {
          send("error", { message: "couldn't reply just now" });
        } else {
          send("done", { contribution: toDTO(contribution) });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 200) : "reply failed";
        send("error", { message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering so chunks flush immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
