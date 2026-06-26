import React from "react";

// Render a contribution's text with a tiny, SAFE markdown subset:
// **bold**, *italic*, `code`. Everything is rendered as React elements (never
// dangerouslySetInnerHTML), so user content can't inject markup.
export function InlineText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <span className="prose-inline">
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {parseInline(line)}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </span>
  );
}

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

function parseInline(line: string): React.ReactNode[] {
  const parts = line.split(TOKEN);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
