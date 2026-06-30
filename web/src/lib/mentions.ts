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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Editor ↔ storage bridge. People are SHOWN as plain "@Display Name" while typing
// (no ugly id), and converted to the stored "@[Name](id)" token only on submit.
//
// serializeMentions: "@Display Name" → "@[Display Name](id)" for known people.
// Longest names first so "@Sam" never eats into "@Samuel"; a name is only matched
// as a whole token (followed by end/space/punctuation), and existing tokens are
// left untouched.
export function serializeMentions(text: string, people: { id: string; name: string }[]): string {
  let out = text;
  const sorted = [...people]
    .filter((p) => p.name && p.name.trim())
    .sort((a, b) => b.name.length - a.name.length);
  for (const p of sorted) {
    const safe = p.name.replace(/[\]()]/g, "").trim();
    if (!safe) continue;
    const re = new RegExp(`@${escapeRegExp(safe)}(?!\\]\\()(?=$|[\\s.,!?;:'")\\]])`, "g");
    out = out.replace(re, `@[${safe}](${p.id})`);
  }
  return out;
}

// deserializeMentions: "@[Name](id)" → "@Name", so an existing message reads
// cleanly when reopened in the editor.
export function deserializeMentions(text: string): string {
  return text.replace(mentionRegex(), (_full, name) => `@${name}`);
}
