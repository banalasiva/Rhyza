import { db } from "@/lib/db";

// The one number that decides whether the whole notification pipeline matters:
// what fraction of real users can we actually reach on push? Every trigger we
// fire (weigh-in, ask, deadline, rekindle…) delivers NOTHING to a user who
// never subscribed a device or turned push off — so if this number is low, the
// leak is opt-in, not triggers.
//
// Derived entirely from data we already store:
//   • a user is "reachable" once they have ≥1 push subscription AND pushNotify ≠ false
//   • "subscribed" counts anyone with a device, regardless of the pref
//   • "turnedOff" counts users who explicitly disabled push
// AI teammates (Claude/ChatGPT) are never people — excluded. Best-effort: any
// hiccup returns ok:false so the admin page still renders.

export type PushReach = {
  ok: boolean;
  users: number; // real, non-deleted humans
  subscribed: number; // have ≥1 device subscription
  reachable: number; // subscribed AND haven't turned push off
  turnedOff: number; // pushNotify === false
  devices: number; // total subscription rows (multi-device)
};

const EMPTY: PushReach = {
  ok: false,
  users: 0,
  subscribed: 0,
  reachable: 0,
  turnedOff: 0,
  devices: 0,
};

export async function getPushReach(): Promise<PushReach> {
  try {
    const aiUsers = await db.user.findMany({
      where: { name: { in: ["Claude", "ChatGPT"] } },
      select: { id: true },
    });
    const aiIds = new Set(aiUsers.map((u) => u.id));

    const users = await db.user.findMany({
      where: { deletedAt: null },
      select: { id: true, pushNotify: true },
    });
    const humans = users.filter((u) => !aiIds.has(u.id));
    if (humans.length === 0) return { ...EMPTY, ok: true };

    const humanIds = new Set(humans.map((u) => u.id));

    // Distinct users who own at least one device, plus the raw device count.
    const subs = await db.pushSubscription.findMany({
      select: { userId: true },
    });
    const withDevice = new Set<string>();
    let devices = 0;
    for (const s of subs) {
      if (!humanIds.has(s.userId)) continue;
      devices++;
      withDevice.add(s.userId);
    }

    const turnedOff = humans.filter((u) => u.pushNotify === false).length;
    // Actually reachable RIGHT NOW: has a device and hasn't opted out.
    const reachable = humans.filter(
      (u) => u.pushNotify !== false && withDevice.has(u.id),
    ).length;

    return {
      ok: true,
      users: humans.length,
      subscribed: withDevice.size,
      reachable,
      turnedOff,
      devices,
    };
  } catch {
    return EMPTY;
  }
}
