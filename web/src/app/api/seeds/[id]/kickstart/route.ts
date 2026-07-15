import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { kickstartSeed } from "@/lib/services/contributions";

// POST /api/seeds/:id/kickstart — make sure Claude has opened this seed.
//
// Planting a seed fires kickstartSeed fire-and-forget on the plant route, but a
// serverless instance can freeze the moment it returns the response and drop
// that background work — leaving a freshly-planted seed silent, which is the
// worst possible first-five-minutes experience. So the seed room calls this
// from the client whenever it opens on an empty thread, guaranteeing the opener
// runs in its own invocation with room to finish the model call.
//
// kickstartSeed is idempotent — it only acts while the thread is still empty and
// only ever posts a single Claude opener — so triggering it from both the plant
// route and here can never double-post.
export const maxDuration = 120;

export const POST = handle(async (_req, ctx: { params: { id: string } }) => {
  await requireUserId();
  await kickstartSeed(ctx.params.id);
  return ok({ ok: true });
});
