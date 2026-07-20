import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronAuthorized, markCronRun } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Nightly retention/cleanup so the high-write, transient tables don't grow
// unbounded (rate_limits accumulates a row per key forever; notifications and
// the event logs grow with activity). Each delete is BOUNDED with a LIMIT (via a
// ctid subquery) so a single run can never take a giant lock — at scale this
// should move to a queue that drains in batches, but bounded deletes keep it
// safe in the meantime. Best-effort per table; one failure doesn't stop the rest.
const BATCH = 20000;

async function boundedDelete(table: string, whereSql: string): Promise<number> {
  try {
    const n = await db.$executeRawUnsafe(
      `DELETE FROM "${table}" WHERE ctid IN (SELECT ctid FROM "${table}" WHERE ${whereSql} LIMIT ${BATCH})`,
    );
    return Number(n) || 0;
  } catch (err) {
    console.error(`cleanup: ${table} failed`, err);
    return 0;
  }
}

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Expired rate-limit windows (transient — safe to drop once past reset_at).
  const rateLimits = await boundedDelete("rate_limits", "reset_at < now() - interval '1 hour'");
  // Read notifications older than 60 days (the deep-link target is long gone).
  const notifications = await boundedDelete(
    "notifications",
    "read_at IS NOT NULL AND created_at < now() - interval '60 days'",
  );
  // Auth-failure log older than 90 days (the admin sev2 view only needs recent).
  const authEvents = await boundedDelete("auth_events", "created_at < now() - interval '90 days'");
  // AI-tag usage events older than 180 days (metering is monthly/rolling).
  const aiTagEvents = await boundedDelete("ai_tag_events", "created_at < now() - interval '180 days'");
  // Spent/expired WebAuthn challenges (single-use; most are deleted on verify,
  // this sweeps the ones from abandoned ceremonies so the table can't grow).
  const webauthn = await boundedDelete(
    "webauthn_challenges",
    "expires_at < now() - interval '1 hour'",
  );

  const detail = `rl ${rateLimits} · notif ${notifications} · auth ${authEvents} · aitag ${aiTagEvents} · wac ${webauthn}`;
  await markCronRun("cleanup", detail);
  return NextResponse.json({ ok: true, rateLimits, notifications, authEvents, aiTagEvents, webauthn });
}
