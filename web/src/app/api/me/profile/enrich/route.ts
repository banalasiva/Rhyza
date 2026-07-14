import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { refreshUserTopics, refreshUserReflection } from "@/lib/services/profile";

// Generating a person's AI topics + reflection is a Claude call (seconds). It's
// done HERE — out of the page render path — so /roots and the owner's profile
// load instantly and these fill in afterward via a client refresh. Owner-only:
// you only ever enrich yourself.
export const maxDuration = 60;

export const POST = handle(async () => {
  const userId = await requireUserId();
  await Promise.all([
    refreshUserTopics(userId).catch(() => {}),
    refreshUserReflection(userId).catch(() => {}),
  ]);
  return ok({ ok: true });
});
