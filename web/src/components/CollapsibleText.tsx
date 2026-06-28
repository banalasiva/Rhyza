"use client";

import { useState } from "react";
import { InlineText } from "@/components/InlineText";

// Renders a message, but collapses long ones behind a "Show more" toggle so the
// thread stays scannable. Truncates at a word boundary near `limit` characters.
export function CollapsibleText({ text, limit = 360 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);

  if (text.length <= limit) return <InlineText text={text} />;

  // Cut at the last space before the limit so we don't slice a word in half.
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  const truncated = (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();

  return (
    <>
      <InlineText text={expanded ? text : `${truncated}…`} />{" "}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="text-xs font-medium text-accent transition hover:underline"
        aria-expanded={expanded}
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </>
  );
}
