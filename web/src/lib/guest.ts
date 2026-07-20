import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";

// A "guest" is a real but lightweight user: a typed name and a synthetic email,
// minted only through a valid invite (someone vouched for them). The synthetic
// email domain IS the marker — the same trick phone login uses — so no schema
// column is needed and every capability check is one string test.
export const GUEST_EMAIL_DOMAIN = "@guest.thinkthru.app";

export function isGuestEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(GUEST_EMAIL_DOMAIN);
}

export async function isGuestUser(userId: string): Promise<boolean> {
  const u = await db.user
    .findUnique({ where: { id: userId }, select: { email: true } })
    .catch(() => null);
  return isGuestEmail(u?.email);
}

// Guard for actions a guest may not take (create a seed/garden, invite others,
// tag an AI). Throws a clear, client-facing message that doubles as the upgrade
// nudge. `action` completes "Create a free account to …".
export async function assertNotGuest(userId: string, action = "do that"): Promise<void> {
  if (await isGuestUser(userId)) {
    throw new ApiError("FORBIDDEN", `Create a free account to ${action}.`);
  }
}

// Sanitise a typed guest display name: drop control characters (code < 32 or
// 127) without a literal control regex, collapse whitespace, cap length, and
// block impersonation of the AI/system identities.
export function cleanGuestName(raw: string): string | null {
  const name = Array.from(raw || "")
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c >= 32 && c !== 127;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  if (name.length < 1) return null;
  if (/^(claude|chat\s*gpt|openai|anthropic|thinkthru|admin|system)$/i.test(name)) return null;
  return name;
}
