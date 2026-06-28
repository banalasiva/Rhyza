import React from "react";

// Render a contribution's text with a tiny, SAFE markdown subset:
// **bold**, *italic*, `code`, and [label](https://…) links. Everything is
// rendered as React elements (never dangerouslySetInnerHTML), so user content
// can't inject markup, and only http(s) links are honoured.
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

// @[Name](uuid) mention, [label](https://…) link, **bold**, *italic*, `code`.
const TOKEN =
  /(@\[[^\]]+\]\([0-9a-fA-F-]{36}\)|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
const MENTION = /^@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)$/;
const LINK = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/;

function parseInline(line: string): React.ReactNode[] {
  const parts = line.split(TOKEN);
  return parts.map((part, i) => {
    const mention = part.match(MENTION);
    if (mention) {
      return (
        <span key={i} className="mention">
          @{mention[1]}
        </span>
      );
    }
    const link = part.match(LINK);
    if (link) {
      return (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer nofollow">
          {link[1]}
        </a>
      );
    }
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
