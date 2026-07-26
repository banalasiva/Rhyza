// A warm, ready-to-paste invite message — what Copy / Share / WhatsApp put on
// the clipboard, instead of a bare link that reads cold or sketchy. When it's
// for a specific seed, it leads with the actual question (the hook that makes
// someone want to open it): the place they'll land + the question being worked
// out — e.g. Banala · "How does tax filing work?".
export function inviteMessage({
  place,
  topic,
  link,
  email,
}: {
  place?: string;
  topic?: string; // the seed's question, when inviting to a specific seed
  link: string;
  email?: string;
}): string {
  const where = place ? ` in ${place}` : "";
  const lines = [`🌱 You're invited to ThinkThru!`, ``];
  const t = topic?.trim();
  if (t) {
    lines.push(
      `Come help me think this through${where}:`,
      `“${t}”`,
      ``,
      `It's a calm little space where a group works out a decision together, one honest thought at a time. I'd really love your take.`,
    );
  } else {
    lines.push(
      `Come think this through with me${where} — a calm little space where a group works out a decision together, one honest thought at a time. I'd really love your take.`,
    );
  }
  lines.push(``, `Tap to join:`, link);
  if (email) lines.push(``, `(This invite is just for you, ${email}.)`);
  return lines.join("\n");
}
