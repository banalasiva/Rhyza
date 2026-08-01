"use client";
import Pusher from "pusher-js";

// Client half of the realtime layer. Subscribes to a seed's "changed" pings so
// the room can sync the instant someone else posts, instead of waiting for the
// next poll. Gated on the public Pusher vars — when they're absent this is inert
// and the room runs on polling alone (see realtime.ts for the server half).

const KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

export function realtimeClientConfigured(): boolean {
  return !!(KEY && CLUSTER);
}

let pusher: Pusher | null = null;
function getPusher(): Pusher | null {
  if (!realtimeClientConfigured()) return null;
  if (!pusher) {
    pusher = new Pusher(KEY!, { cluster: CLUSTER!, enabledTransports: ["ws", "wss"] });
  }
  return pusher;
}

// Listen for a seed's change pings. `onChange` fires whenever anyone changes the
// thread; the caller decides what to do (here: sync immediately). Returns an
// unsubscribe fn — a no-op when Pusher isn't configured, so the caller can call
// it unconditionally on cleanup.
export function subscribeSeed(seedId: string, onChange: () => void): () => void {
  const p = getPusher();
  if (!p) return () => {};
  const name = `seed-${seedId}`;
  const channel = p.subscribe(name);
  channel.bind("changed", onChange);
  return () => {
    channel.unbind("changed", onChange);
    p.unsubscribe(name);
  };
}
