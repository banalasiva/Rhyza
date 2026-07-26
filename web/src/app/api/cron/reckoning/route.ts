import { NextResponse } from "next/server";
import { cronAuthorized, markCronRun } from "@/lib/cron";
import { openDueReckonings, RECKON_DAYS } from "@/lib/services/reckoning";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The day-21 reckoning nudge. Once a day, find decisions that bloomed ~21 days
// ago and haven't had their reckoning opened yet, open them, and invite the
// people who made them to look back together (JUDGEMENT — the fourth virtue).
// Bounded per run so a backlog drains a batch at a time rather than fanning out
// unboundedly in one tick.
const MAX_PER_RUN = 25;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { opened, ids } = await openDueReckonings(MAX_PER_RUN);
  const detail = `opened ${opened} (≥${RECKON_DAYS}d)`;
  await markCronRun("reckoning", detail);
  return NextResponse.json({ ok: true, opened, ids });
}
