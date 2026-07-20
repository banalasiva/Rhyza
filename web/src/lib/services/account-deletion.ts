import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";

// Delete an account by ANONYMISING it in place (GDPR-friendly):
//  • login + device identifiers are removed (they can never sign in again),
//  • their personal/private data is deleted,
//  • their messages in shared threads stay, re-attributed to "Deleted user" so
//    group conversations aren't gutted,
//  • the user row is scrubbed (name/email/photo cleared) — NOT row-deleted, which
//    would cascade and risk taking shared content, and frees their email so they
//    could start fresh.
// A PII-free line is written to account_deletions for compliance.
//
// Every cleanup step is best-effort and isolated: a failing one is logged and
// skipped so it can never block the core scrub. Safe to call twice (idempotent
// via deletedAt).

const SYSTEM_NAMES = ["Claude", "ChatGPT"];

async function best(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (err) {
    console.error("[account-deletion] step failed (skipped):", err);
  }
}

export async function deleteAccount(userId: string, actor: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!user) throw new ApiError("NOT_FOUND", "Account not found");
  if (user.deletedAt) return; // already deleted — idempotent no-op
  if (SYSTEM_NAMES.includes(user.name)) {
    throw new ApiError("FORBIDDEN", "That's a system account and can't be deleted.");
  }

  // 1 · Kill every way back in — OAuth links, sessions, passkeys, device push
  //     tokens, phone identity. After this the account cannot authenticate.
  await best(() => db.account.deleteMany({ where: { userId } }));
  await best(() => db.session.deleteMany({ where: { userId } }));
  await best(() => db.passkey.deleteMany({ where: { userId } }));
  await best(() => db.pushSubscription.deleteMany({ where: { userId } }));
  await best(() => db.$executeRaw`DELETE FROM "phone_identities" WHERE "user_id" = ${userId}::uuid`);

  // 2 · Delete their personal / private data — nobody else depends on it.
  await best(() => db.notification.deleteMany({ where: { recipientId: userId } }));
  await best(() => db.keptContribution.deleteMany({ where: { userId } }));
  await best(() => db.bloomReflection.deleteMany({ where: { userId } }));
  await best(() => db.$executeRaw`DELETE FROM "bloom_calibrations" WHERE "responder_id" = ${userId}::uuid`);
  await best(() => db.userInterest.deleteMany({ where: { userId } }));
  await best(() => db.$executeRaw`DELETE FROM "user_topics" WHERE "user_id" = ${userId}::uuid`);
  await best(() => db.seedFollow.deleteMany({ where: { userId } }));
  await best(() => db.seedReport.deleteMany({ where: { reporterId: userId } }));
  await best(() => db.seedDraft.deleteMany({ where: { userId } }));

  // 3 · Remove them from every member roster — they're gone from the circles.
  await best(() => db.orgMember.deleteMany({ where: { userId } }));
  await best(() => db.gardenMember.deleteMany({ where: { userId } }));
  await best(() => db.seedMember.deleteMany({ where: { userId } }));

  // 4 · Scrub the account row in place. Contributions, votes and blooms they
  //     authored stay, but now read as "Deleted user". Email is randomised (so it
  //     can never receive mail and the original is freed), notifications off,
  //     tombstoned with deletedAt.
  await db.user.update({
    where: { id: userId },
    data: {
      name: "Deleted user",
      email: `deleted_${randomUUID()}@deleted.thinkthru.app`,
      image: null,
      bio: null,
      unsubToken: null,
      emailVerified: null,
      emailNotify: false,
      pushNotify: false,
      digestNotify: false,
      deletedAt: new Date(),
    },
  });

  // 5 · Compliance audit — PII-free (id, when, who, how).
  await best(
    () =>
      db.$executeRaw`INSERT INTO "account_deletions" ("deleted_user_id", "actor", "method") VALUES (${userId}::uuid, ${actor}, 'anonymise')`,
  );
}
