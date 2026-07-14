import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { saveDraft, clearDraft, type DraftAttachment } from "@/lib/services/drafts";

// PUT /api/seeds/:id/draft — upsert the current unsent draft (debounced from the
// client as they type). Body: { text, attachments? }. Empty clears it.
export const PUT = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    attachments?: DraftAttachment[];
  };
  return ok(await saveDraft(userId, ctx.params.id, body.text ?? "", body.attachments ?? []));
});

// DELETE /api/seeds/:id/draft — clear the draft (on send, or "discard draft").
export const DELETE = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await clearDraft(userId, ctx.params.id));
});
