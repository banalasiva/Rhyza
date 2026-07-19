import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";

// WebAuthn / passkey plumbing shared by the register + login routes.
//
// The "relying party" (RP) is this site. WebAuthn ties every credential to the
// RP ID (the registrable domain) and checks the ceremony happened on the
// expected origin — so a passkey made on thinkthru.app can never be used
// anywhere else. Both are derived from APP_URL, with a localhost-friendly
// default for dev.

export function rpConfig(): { rpID: string; rpName: string; origin: string } {
  const origin = appUrl().replace(/\/$/, "");
  let rpID = "localhost";
  try {
    rpID = new URL(origin).hostname; // e.g. "thinkthru.app" (no scheme/port)
  } catch {
    /* keep localhost */
  }
  return { rpID, rpName: "ThinkThru", origin };
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // a ceremony that takes >5 min is stale

// Persist a challenge between the two round-trips of a ceremony (options →
// verify). Returns the row id the client echoes back on verify. Best-effort
// sweep of this user's / anonymous expired rows keeps the table tidy without a
// cron.
export async function saveChallenge(
  kind: "reg" | "auth",
  challenge: string,
  userId: string | null,
): Promise<string> {
  const row = await db.webAuthnChallenge.create({
    data: {
      challenge,
      kind,
      userId,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
    select: { id: true },
  });
  return row.id;
}

// Single-use: fetch, delete, and validate a challenge. Returns the challenge
// string (and the userId it was bound to) or null if it's missing, the wrong
// kind, or expired. Deleting on read makes every challenge usable exactly once,
// which is what stops a captured ceremony from being replayed.
export async function consumeChallenge(
  id: string,
  kind: "reg" | "auth",
): Promise<{ challenge: string; userId: string | null } | null> {
  if (!id) return null;
  const row = await db.webAuthnChallenge.findUnique({ where: { id } }).catch(() => null);
  if (!row) return null;
  await db.webAuthnChallenge.delete({ where: { id } }).catch(() => {});
  if (row.kind !== kind) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return { challenge: row.challenge, userId: row.userId };
}
