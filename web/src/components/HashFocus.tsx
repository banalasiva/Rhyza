"use client";

import { useEffect } from "react";

// When the page is opened with a #hash, scroll that element into view and give
// it the same brief glow used for notification deep-links — so arriving via
// "✚ New garden" / "✚ Plant a seed" lands you right on the form and shows you
// where you are.
export function HashFocus() {
  useEffect(() => {
    function focusHash() {
      const id = window.location.hash.replace(/^#/, "");
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("endorsed-glow");
      window.setTimeout(() => el.classList.remove("endorsed-glow"), 2400);
    }
    // On first load (navigated in with a #hash)…
    const t = setTimeout(focusHash, 350);
    // …and when the hash changes while already on the page.
    window.addEventListener("hashchange", focusHash);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", focusHash);
    };
  }, []);
  return null;
}
