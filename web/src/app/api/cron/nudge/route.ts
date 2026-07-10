import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { pushConfigured, sendPushToUser } from "@/lib/push";
import { sendGoodMorning, summarise } from "@/lib/services/morning";
import { cronAuthorized, markCronRun } from "@/lib/cron";

export const dynamic = "force-dynamic";

// A twice-daily re-engagement push (morning + evening, see vercel.json).
//
// Morning slot (02:30 UTC ≈ 08:00 IST): a daily "Good morning 🌱" to everyone
// who wants push — never an empty ping, because people with unseen activity get
// the news and everyone else gets the quote of the day (see sendGoodMorning).
//
// Evening slot: strictly CONTENT-DRIVEN — a person is only pinged when they
// have genuinely unseen activity waiting (unread, not yet rolled into a previous
// nudge). Empty queue → no push, so the evening never becomes hollow "we miss
// you!" spam.
//
// Instant per-event push still happens in lib/services/notify.ts; this only
// re-surfaces what was missed, summarised into a single tap-through.

// How far back a nudge will reach for unseen activity. Two slots ~12h apart with
// a 24h window means a missed morning item can still be caught in the evening,
// but nudgedAt stamping guarantees it's summarised at most once.
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

// GET /api/cron/nudge — protected so only the scheduler runs it (see cron.ts:
// works whether or not CRON_SECRET is set, so a missing secret can't silently
// 401 the morning push into oblivion).
export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const slot = new Date().getUTCHours() < 6 ? "morning" : "evening";
  if (!pushConfigured()) {
    await markCronRun(slot, "push not configured");
    return NextResponse.json({ ok: true, sent: 0, note: "push not configured" });
  }

  // Morning → daily good-morning to everyone who wants push.
  if (slot === "morning") {
    const r = await sendGoodMorning();
    await markCronRun("morning", `sent ${r.sent}/${r.recipients}`);
    return NextResponse.json({ ok: true, slot: "morning", ...r });
  }

  // Evening → content-driven only.
  const cutoff = new Date(Date.now() - LOOKBACK_MS);
  const pending = await db.notification.findMany({
    where: {
      readAt: null,
      nudgedAt: null,
      createdAt: { gte: cutoff },
      recipient: { pushNotify: true, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: { id: true, type: true, recipientId: true },
  });

  const groups = new Map<string, { ids: string[]; types: string[] }>();
  for (const n of pending) {
    const g = groups.get(n.recipientId) ?? { ids: [], types: [] };
    g.ids.push(n.id);
    g.types.push(n.type);
    groups.set(n.recipientId, g);
  }

  const url = `${appUrl()}/notifications`;
  let sent = 0;
  for (const [recipientId, g] of groups) {
    const delivered = await sendPushToUser(recipientId, {
      title: "ThinkThru",
      body: summarise(g.types),
      url,
      tag: "nudge", // collapses with any previous nudge on the device
    });
    // Stamp regardless of delivery: if the device couldn't be reached we still
    // don't want to keep re-counting the same stale items every slot.
    await db.notification
      .updateMany({ where: { id: { in: g.ids } }, data: { nudgedAt: new Date() } })
      .catch(() => {});
    if (delivered > 0) sent++;
  }

  await markCronRun("evening", `sent ${sent}/${groups.size}`);
  return NextResponse.json({ ok: true, slot: "evening", recipients: groups.size, sent });
}
