import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { pushConfigured, sendPushToUser } from "@/lib/push";
import { questionOfTheDay } from "@/lib/daily-questions";
import { mapLimit } from "@/lib/concurrency";

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

  // The one daily broadcast is the QUESTION OF THE DAY — a light, tap-to-answer
  // hook, not a mass "good morning quote". The quote still greets anyone who
  // opens Home (the MorningQuote card); it's no longer pushed to everyone.
  const homeUrl = appUrl();
  const question = questionOfTheDay().text;
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
  // NOTE: capped at PUSH_FANOUT_CAP per run. Beyond that a single cron can't
  // finish inside the function time limit — that's the point where the morning
  // fan-out should move to a queue (see SCALING.md). We log when we hit the cap
  // so it's never a silent drop.
  const CAP = Number(process.env.PUSH_FANOUT_CAP || 20000);
  const people = await db.user.findMany({
    where: { pushNotify: true, deletedAt: null },
    select: { id: true },
    take: CAP,
  });
  if (people.length >= CAP) {
    console.warn(`[morning] hit fan-out cap of ${CAP} — move to a queue (see SCALING.md).`);
  }

  // Send with bounded concurrency instead of one-at-a-time: far faster per run,
  // without opening thousands of simultaneous push requests.
  const CONCURRENCY = Number(process.env.PUSH_FANOUT_CONCURRENCY || 24);
  const outcomes = await mapLimit(people, CONCURRENCY, async (p: { id: string }) => {
    const g = groups.get(p.id);
    // The daily question is the hook that pulls people in — so it LEADS the push
    // for EVERYONE, every morning, with the touching quote right below it.
    // (Previously anyone with unseen activity — e.g. the owner — got the quote
    // only and never the question, which is why it didn't arrive as a
    // notification.) If there's unseen activity we just hint the count in the
    // title; the evening slot surfaces the actual activity.
    const title = g ? `💭 Question of the day · ${g.ids.length} waiting` : "💭 Question of the day";
    const body = `${question}\nTap to answer & see how everyone votes.`;
    return sendPushToUser(p.id, {
      title,
      body,
      url: homeUrl, // land on Home, where the question card is
      tag: "nudge", // collapses with any previous nudge on the device
    }).catch(() => 0);
  });
  const sent = outcomes.filter((n) => n > 0).length;

  return { sent, recipients: people.length };
}
