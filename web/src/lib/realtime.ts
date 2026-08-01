// Server-only module: only imported from service/route code. PUSHER_SECRET is a
// non-public env var, so it is never inlined into the client bundle even if this
// were pulled in by accident.
import Pusher from "pusher";

// ── Realtime push (Pusher) ─────────────────────────────────────────────────
// Optional instant-push layer. When the PUSHER_* env vars are set, a write that
// changes a seed's thread publishes a tiny "changed" ping to that seed's channel,
// and connected clients sync immediately instead of waiting for the next poll.
// When the vars are ABSENT, everything here is a no-op and the app runs exactly
// as before on polling alone — so this can never break a deployment that hasn't
// set it up. Publishing is always best-effort: a Pusher hiccup must never fail
// the underlying write (the poll remains the backstop).

const APP_ID = process.env.PUSHER_APP_ID;
const KEY = process.env.PUSHER_KEY;
const SECRET = process.env.PUSHER_SECRET;
const CLUSTER = process.env.PUSHER_CLUSTER;

export function realtimeConfigured(): boolean {
  return !!(APP_ID && KEY && SECRET && CLUSTER);
}

let client: Pusher | null = null;
function getClient(): Pusher | null {
  if (!realtimeConfigured()) return null;
  if (!client) {
    client = new Pusher({
      appId: APP_ID!,
      key: KEY!,
      secret: SECRET!,
      cluster: CLUSTER!,
      useTLS: true,
    });
  }
  return client;
}

// One channel per seed. Pusher channel names allow [A-Za-z0-9_\-=@,.;]; a UUID
// fits as-is.
export function seedChannel(seedId: string): string {
  return `seed-${seedId}`;
}

// Ping a seed's channel that its thread changed. Clients listening react by
// pulling the latest snapshot (the same delta sync the poll uses), so we don't
// have to serialize every event shape here — the ping just says "sync now".
// Fire-and-forget: never awaited on the write path, never throws.
export function notifySeedChanged(seedId: string): void {
  const c = getClient();
  if (!c) return;
  c.trigger(seedChannel(seedId), "changed", { at: Date.now() }).catch((err) => {
    console.error("realtime notifySeedChanged failed", err);
  });
}
