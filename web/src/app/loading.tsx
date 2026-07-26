import { SproutLoader } from "@/components/SproutLoader";

// The app-wide route loader — the resting golden sprout (same warm spotlight
// ground as the bloom), replacing the old emblem "Loading…" screen. Renders for
// any route without its own loader, and makes planting one continuous moment:
// the germination overlay hands straight off to this while the thread loads.
export default function Loading() {
  return <SproutLoader />;
}
