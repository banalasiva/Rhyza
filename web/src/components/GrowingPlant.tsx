"use client";

import { useEffect, useState } from "react";
import { PlantSvg } from "@/components/PlantSvg";

// The landing hero: a plant that grows seed → bloom on a gentle loop, so a
// first-time visitor *sees* what "we help conversations bloom" means.
const SEQUENCE = [0, 1, 2, 3, 4, 4, 4, 4]; // grow, then hold the bloom

export function GrowingPlant() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SEQUENCE.length), 1300);
    return () => clearInterval(t);
  }, []);
  const stage = SEQUENCE[i];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      {/* soft glow that swells as it blooms */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full blur-2xl transition-all duration-1000"
        style={{
          background:
            stage >= 4
              ? "radial-gradient(circle, rgba(255,179,0,0.22), transparent 65%)"
              : "radial-gradient(circle, rgba(76,175,80,0.14), transparent 65%)",
          transform: `scale(${0.8 + stage * 0.08})`,
        }}
      />
      <PlantSvg stage={stage} />
    </div>
  );
}
