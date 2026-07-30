import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { pushConfigured, sendPushToUser } from "@/lib/push";
import { resolveMessageOfTheDay } from "@/lib/services/daily";
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
  if (has("deadline")) return `It's time to move a decision forward 🕰️`;
  if (has("endorsement")) return `Your thinking was found valuable ✦`;
  if (has("stage_change")) return `The room is moving on something you're in 🌿`;
  if (n === 1) return `1 new thing in your gardens 🌿`;
  return `${n} new things in your gardens 🌿`;
}

// The daily "thought for today" push. Unlike the content-driven evening nudge,
// this goes to EVERYONE who wants push — the quote of the day, with a soft
// "N waiting" hint for anyone who also has unseen activity. Title is
// time-neutral (global audience — no "good morning"). Respects pushNotify and
// only reaches devices that actually subscribed (sendPushToUser no-ops
// otherwise). Shared by the morning cron slot and the manual admin trigger.
export async function sendGoodMorning(): Promise<{ sent: number; recipients: number }> {
  if (!pushConfigured()) return { sent: 0, recipients: 0 };

  // The daily broadcast is the "Good morning 🌱" QUOTE — the same owner-curated
  // message that greets people on Home, sent as a gentle push. (It used to push
  // the "Question of the day · tap to answer" prompt instead; that read as a
  // demand rather than a hello, so the push is the quote again.)
  const homeUrl = appUrl();
  const quote = await resolveMessageOfTheDay();
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
  // The daily quote as the body; the author (when set) signs it. The title is
  // TIME-NEUTRAL on purpose — the audience is global, so "Good morning" would be
  // wrong for the half of them where it's midday or midnight. If the person has
  // unseen activity we add a soft "N waiting" as a gentle reason to tap through;
  // the evening slot surfaces the actual activity.
  const quoteBody = quote.author ? `${quote.text}\n— ${quote.author}` : quote.text;
  const outcomes = await mapLimit(people, CONCURRENCY, async (p: { id: string }) => {
    const g = groups.get(p.id);
    const title = g ? `🌱 A thought for today · ${g.ids.length} waiting` : "🌱 A thought for today";
    return sendPushToUser(p.id, {
      title,
      body: quoteBody,
      url: homeUrl, // land on Home, where the quote & question cards live
      tag: "nudge", // collapses with any previous nudge on the device
    }).catch(() => 0);
  });
  const sent = outcomes.filter((n) => n > 0).length;

  return { sent, recipients: people.length };
}
