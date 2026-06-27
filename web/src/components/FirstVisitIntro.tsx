"use client";

import { useEffect, useState } from "react";
import { HowItWorks } from "@/components/HowItWorks";

// Shows the "Welcome to Rhyza" intro once, the first time someone lands after
// signing in. Shares the same localStorage flag as the seed-room intro, so a
// member only ever sees it once regardless of where they enter.
export function FirstVisitIntro() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem("rhyza_seen_intro")) {
        setShow(true);
        localStorage.setItem("rhyza_seen_intro", "1");
      }
    } catch {
      /* localStorage unavailable — skip */
    }
  }, []);
  if (!show) return null;
  return <HowItWorks onClose={() => setShow(false)} />;
}
