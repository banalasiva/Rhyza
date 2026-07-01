import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { resolveMessageOfTheDay } from "@/lib/services/daily";

export const dynamic = "force-dynamic";

// GET /api/daily-message — today's shared "good morning" message (from the
// editable DB library, or the built-in set as a fallback).
export const GET = handle(async () => {
  await requireUserId();
  return ok(await resolveMessageOfTheDay());
});
