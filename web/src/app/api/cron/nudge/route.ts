import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { pushConfigured, sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

// A twice-daily re-engagement push (morning + evening, see vercel.json). This is
// the gentle "come back" nudge — but it is strictly CONTENT-DRIVEN: a person is
// only pinged when they have genuinely unseen activity waiting (unread, not yet
// rolled into a previous nudge). Empty queue → no push at all, so the cadence
// never becomes the kind of hollow "we miss you!" spam that gets apps deleted.
//
// Instant per-event push still happens in lib/services/notify.ts; this only
// re-surfaces what was missed, summarised into a single tap-through.

// How far back a nudge will reach for unseen activity. Two slots ~12h apart with
// a 24h window means a missed morning item can still be caught in the evening,
// but nudgedAt stamping guarantees it's summarised at most once.
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

// Turn a bag of unread notifications into one friendly summary line.
function summarise(types: string[]): string {
  const n = types.length;
  const has = (t: string) => types.includes(t);
  if (has("mention")) {
    const others = n - 1;
    return others > 0
      ? `Someone mentioned you — and ${others} more thing${others > 1 ? "s" : ""} waiting 🌿`
      : `Someone mentioned you 🌿`;
  }
  if (has("bloom")) return `A seed you're in just bloomed 🌸`;
  if (has("endorsement")) return `Your thinking was found valuable ✦`;
  if (n === 1) return `1 new thing in your gardens 🌿`;
  return `${n} new things in your gardens 🌿`;
}

// GET /api/cron/nudge — protected by CRON_SECRET so only the scheduler runs it.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ ok: true, sent: 0, note: "push not configured" });
  }

  const cutoff = new Date(Date.now() - LOOKBACK_MS);
  // Unseen (unread), not-yet-nudged activity for people who still want push.
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

  // Group by recipient.
  const groups = new Map<string, { ids: string[]; types: string[] }>();
  for (const n of pending) {
    const g = groups.get(n.recipientId) ?? { ids: [], types: [] };
    g.ids.push(n.id);
    g.types.push(n.type);
    groups.set(n.recipientId, g);
  }

  const url = `${appUrl()}/notifications`;
  // The morning slot (02:30 UTC ≈ 08:00 IST) opens with a warm "Good morning"
  // so the daily catch-up feels like a friendly hello, not a system ping. The
  // evening slot stays neutral.
  const morning = new Date().getUTCHours() < 6;
  const title = morning ? "Good morning 🌱" : "ThinkThru";
  let sent = 0;
  for (const [recipientId, g] of groups) {
    const delivered = await sendPushToUser(recipientId, {
      title,
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

  return NextResponse.json({ ok: true, recipients: groups.size, sent });
}
