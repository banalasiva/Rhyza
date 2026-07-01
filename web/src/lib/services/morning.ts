import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { pushConfigured, sendPushToUser } from "@/lib/push";
import { messageOfTheDay } from "@/lib/daily-messages";

const LOOKBACK_MS = 24 * 60 * 60 * 1000;

// Turn a bag of unread notifications into one friendly summary line.
export function summarise(types: string[]): string {
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
  if (has("stage_change")) return `The room is moving on something you're in 🌿`;
  if (n === 1) return `1 new thing in your gardens 🌿`;
  return `${n} new things in your gardens 🌿`;
}

// The daily "Good morning 🌱" push. Unlike the content-driven evening nudge,
// this goes to EVERYONE who wants push — but it's never an empty ping: people
// with unseen activity get the news, everyone else gets the quote of the day.
// A smile always, sometimes with a reason to tap through. Respects pushNotify
// and only reaches devices that actually subscribed (sendPushToUser no-ops
// otherwise). Shared by the morning cron slot and the manual admin trigger.
export async function sendGoodMorning(): Promise<{ sent: number; recipients: number }> {
  if (!pushConfigured()) return { sent: 0, recipients: 0 };

  const url = `${appUrl()}/notifications`;
  const msg = messageOfTheDay();
  const quoteLine = msg.author ? `“${msg.text}” — ${msg.author}` : msg.text;
  const cutoff = new Date(Date.now() - LOOKBACK_MS);

  // Unseen (unread), not-yet-nudged activity, grouped by recipient.
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

  // Everyone who wants push — the daily hello reaches all of them.
  const people = await db.user.findMany({
    where: { pushNotify: true, deletedAt: null },
    select: { id: true },
    take: 5000,
  });

  let sent = 0;
  for (const p of people) {
    const g = groups.get(p.id);
    const body = g ? summarise(g.types) : quoteLine;
    const delivered = await sendPushToUser(p.id, {
      title: "Good morning 🌱",
      body,
      url,
      tag: "nudge", // collapses with any previous nudge on the device
    });
    // Stamp the activity we just summarised so it isn't re-counted next slot.
    if (g) {
      await db.notification
        .updateMany({ where: { id: { in: g.ids } }, data: { nudgedAt: new Date() } })
        .catch(() => {});
    }
    if (delivered > 0) sent++;
  }

  return { sent, recipients: people.length };
}
