"use client";

import { useState } from "react";
import { InlineText } from "@/components/InlineText";

// Renders a message, but collapses long ones behind a "Show more" toggle so the
// thread stays scannable. "Long" = past ~280 characters OR more than 6 lines,
// so both wordy paragraphs and tall lists get collapsed. Truncates at a word
// boundary.
const CHAR_LIMIT = 280;
const LINE_LIMIT = 6;

export function CollapsibleText({
  text,
  charLimit = CHAR_LIMIT,
  lineLimit = LINE_LIMIT,
}: {
  text: string;
  charLimit?: number;
  lineLimit?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const lines = text.split("\n");
  const isLong = text.length > charLimit || lines.length > lineLimit;
  if (!isLong) return <InlineText text={text} />;

  // Cap by lines first, then by characters at a word boundary.
  let truncated = lines.slice(0, lineLimit).join("\n");
  if (truncated.length > charLimit) {
    const cut = truncated.slice(0, charLimit);
    const lastSpace = cut.lastIndexOf(" ");
    truncated = lastSpace > charLimit * 0.6 ? cut.slice(0, lastSpace) : cut;
  }
  truncated = truncated.trimEnd();

  return (
    <>
      <InlineText text={expanded ? text : `${truncated}…`} />
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="mt-1 block text-xs font-medium text-accent transition hover:underline"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </>
  );
}
