import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { dismissSuggestion } from "@/lib/services/members";

export const dynamic = "force-dynamic";

// POST /api/me/suggestions/dismiss — hide a person from "Suggested for you"
// (don't want to see them, or already requested and waiting). Body: { userId }.
export const POST = handle(async (req) => {
  const me = await requireUserId();
  const { userId } = z.object({ userId: z.string().uuid() }).parse(await req.json());
  await dismissSuggestion(me, userId);
  return ok({ ok: true });
});
