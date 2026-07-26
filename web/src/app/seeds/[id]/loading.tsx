import { PlantingSprout } from "@/components/PlantingSprout";

// The seed route's loader. Instead of the generic emblem "Loading…" screen, we
// keep the sprout on screen in its resting state — so planting a seed is one
// continuous moment (the germination overlay hands straight off to this), and
// there's never a separate loading page between the sprout and the thread.
export default function Loading() {
  return <PlantingSprout hold />;
}
