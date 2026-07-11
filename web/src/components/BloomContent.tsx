import React from "react";
import { InlineText } from "@/components/InlineText";

// Render a bloom's summary as real structure: a lead paragraph, accent section
// labels (from **bold** lines), and genuine bulleted lists (from "• " lines) —
// so the essence / key points / conclusion actually read as scannable points.
// Falls back gracefully for older free-form blooms (just paragraphs).
export function BloomContent({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-2 space-y-1.5">
        {items.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-[1px] text-accent">
              •
            </span>
            <span className="flex-1">
              <InlineText text={b} />
            </span>
          </li>
        ))}
      </ul>,
    );
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      continue;
    }
    // Bullet line: "• …", "- …", or "* …"
    const bullet = line.match(/^[•\-*]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flushBullets();
    // A whole line that's just a bold label, e.g. "**Key points**"
    const label = line.match(/^\*\*(.+?)\*\*:?$/);
    if (label) {
      blocks.push(
        <p
          key={`h-${blocks.length}`}
          className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-accent first:mt-0"
        >
          {label[1]}
        </p>,
      );
      continue;
    }
    blocks.push(
      <p key={`p-${blocks.length}`} className="mb-2 last:mb-0">
        <InlineText text={line} />
      </p>,
    );
  }
  flushBullets();

  return <div>{blocks}</div>;
}
