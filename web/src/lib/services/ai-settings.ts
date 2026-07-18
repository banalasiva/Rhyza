import { db } from "@/lib/db";
import { requireSeedManager } from "@/lib/authz";

// The per-seed AI switch. When a seed's owner/admin turns AI off, the helpers
// (Claude & ChatGPT labelling, replying, the opener, mediation, summaries) all
// stand down for that seed — it stays a purely human conversation. Standalone
// table, read best-effort: a missing row (or missing table) means AI is ON, the
// default everywhere, so nothing regresses before the migration runs.

// Whether AI is enabled for a seed. Defaults to true (on) when unset/unavailable.
export async function seedAiEnabled(seedId: string): Promise<boolean> {
  const row = await db.seedAiSettings
    .findUnique({ where: { seedId }, select: { aiEnabled: true } })
    .catch(() => null);
  return row?.aiEnabled ?? true;
}

// Owner/admin flips the switch. Upsert so the first toggle creates the row.
export async function setSeedAi(userId: string, seedId: string, enabled: boolean) {
  await requireSeedManager(userId, seedId);
  await db.seedAiSettings
    .upsert({
      where: { seedId },
      update: { aiEnabled: enabled },
      create: { seedId, aiEnabled: enabled },
    })
    .catch(() => {});
  return { aiEnabled: enabled };
}
