import { db } from "@/lib/db";
import { isGuestEmail } from "@/lib/guest";

// Move a guest's history onto their real account when they sign up (any method).
//
// FAIL-SAFE BY DESIGN. Every step is scoped strictly to this one guest's rows
// (WHERE <userCol> = guest), runs independently (a failing step is logged and
// skipped, never aborting the rest), and we NEVER delete the guest user — a
// delete would cascade and take any row we didn't reassign. So the worst case is
// "a row stayed on the inert guest shell," never data loss and never anyone
// else's data touched.
//
// For tables with a composite unique key that includes the user, the real
// account may already have a row for the same scope (e.g. both were in the same
// seed). We first drop the guest's colliding row, then reassign the rest.

// (table, userColumn, [scopeColumns]) — reassign, de-duping against the target.
const DEDUP: [string, string, string[]][] = [
  ["org_members", "user_id", ["org_id"]],
  ["garden_members", "user_id", ["garden_id"]],
  ["seed_members", "user_id", ["seed_id"]],
  ["seed_stage_votes", "user_id", ["seed_id"]],
  ["poll_votes", "user_id", ["poll_id"]],
  ["quorum_ballots", "rater_id", ["seed_id", "dimension"]],
  ["seed_follows", "user_id", ["seed_id"]],
  ["kept_contributions", "user_id", ["contribution_id"]],
  ["contribution_reactions", "user_id", ["contribution_id", "reaction_key"]],
  ["contribution_endorsements", "endorser_id", ["contribution_id"]],
  ["bloom_reflections", "user_id", ["bloom_id"]],
  ["bloom_calibrations", "responder_id", ["bloom_id"]],
  ["user_topics", "user_id", ["topic"]],
  ["daily_answers", "user_id", ["day"]],
  ["stake_ratings", "rater_id", ["seed_id", "ratee_id"]],
  ["stake_ratings", "ratee_id", ["seed_id", "rater_id"]],
];

// (table, userColumn) — straight reassign, no per-user unique to collide with.
const SIMPLE: [string, string][] = [
  ["contributions", "author_id"],
  ["notifications", "recipient_id"],
  ["notifications", "actor_id"],
];

// All table/column names above are hard-coded literals (no user input), and the
// two ids are passed as bound parameters — so this is injection-safe despite the
// raw SQL.
async function step(sql: string, guestId: string, targetId: string) {
  try {
    await db.$executeRawUnsafe(sql, guestId, targetId);
  } catch (err) {
    console.error("[guest-merge] step failed (skipped):", sql, err);
  }
}

export async function mergeGuestInto(guestId: string, targetId: string): Promise<boolean> {
  if (!guestId || !targetId || guestId === targetId) return false;
  const [g, t] = await Promise.all([
    db.user.findUnique({ where: { id: guestId }, select: { email: true } }).catch(() => null),
    db.user.findUnique({ where: { id: targetId }, select: { email: true } }).catch(() => null),
  ]);
  // Only ever merge FROM a real guest INTO a real (non-guest) account. Both
  // guards matter: they stop a merge being pointed at an arbitrary account.
  if (!g || !isGuestEmail(g.email)) return false;
  if (!t || isGuestEmail(t.email)) return false;

  for (const [table, col, scope] of DEDUP) {
    const join = scope.map((c) => `t."${c}" = g."${c}"`).join(" AND ");
    await step(
      `DELETE FROM "${table}" AS g WHERE g."${col}" = $1 AND EXISTS (` +
        `SELECT 1 FROM "${table}" t WHERE ${join} AND t."${col}" = $2)`,
      guestId,
      targetId,
    );
    await step(`UPDATE "${table}" SET "${col}" = $2 WHERE "${col}" = $1`, guestId, targetId);
  }
  for (const [table, col] of SIMPLE) {
    await step(`UPDATE "${table}" SET "${col}" = $2 WHERE "${col}" = $1`, guestId, targetId);
  }

  // Deliberately leave the guest user fully intact and inert: NOT deleted (a
  // delete cascades and could take anything unreassigned) and NOT blanked — so
  // in the rare case a row didn't reassign, it still shows the person's real
  // typed name, never a null/"guest" gap. The shell can't be logged into (its
  // email is synthetic), so leaving it costs nothing. Nothing on the target
  // account is ever touched — the merge only ever moves the guest's own rows in.
  return true;
}
