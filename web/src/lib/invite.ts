// A warm, ready-to-paste invite message — what Copy / Share / WhatsApp put on
// the clipboard, instead of a bare link that reads cold or sketchy.
export function inviteMessage({
  place,
  link,
  email,
}: {
  place?: string;
  link: string;
  email?: string;
}): string {
  const where = place ? ` in ${place}` : "";
  const lines = [
    `🌱 You're invited to ThinkThru!`,
    ``,
    `Come think this through with me${where} — a calm little space where a group works out a decision together, one honest thought at a time. I'd really love your take.`,
    ``,
    `Tap to join:`,
    link,
  ];
  if (email) lines.push(``, `(This invite is just for you, ${email}.)`);
  return lines.join("\n");
}
