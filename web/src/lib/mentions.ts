// People are tagged with a structured token the picker inserts:
//   @[Display Name](userId)
// This keeps the display name and the stable user id together, so the text is
// human-readable and the server can resolve exactly who was tagged.

// Matches one mention token. The id is a UUID (hex + dashes, 36 chars).
export const MENTION_TOKEN = /@\[([^\]]+)\]\(([0-9a-fA-F-]{36})\)/;

// Global version for scanning/splitting (don't share lastIndex with the above).
export function mentionRegex(): RegExp {
  return new RegExp(MENTION_TOKEN.source, "g");
}

// Extract the distinct user ids tagged in a piece of text.
export function extractMentionIds(text: string): string[] {
  const ids = new Set<string>();
  const re = mentionRegex();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) ids.add(m[2]);
  return [...ids];
}

// Build a mention token for insertion. Strips characters that would break the
// token syntax from the display name.
export function mentionToken(name: string, userId: string): string {
  const safe = (name || "Someone").replace(/[\]()]/g, "").trim();
  return `@[${safe}](${userId})`;
}
