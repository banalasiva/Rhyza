import { db } from "@/lib/db";

// Auth failures, logged so the owner sees sign-in problems on the admin panel
// (they're a sev2) instead of only hearing about them from a family member.

// Auth.js error codes → plain-language message a first-timer understands. Kept
// here so the login banner and the admin panel describe failures the same way.
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email is already registered a different way. Try the same method you used before.",
  OAuthSignin: "Something went wrong starting Google sign-in. Please try again.",
  OAuthCallback: "Google sign-in didn't come back cleanly. Please try again.",
  OAuthCreateAccount: "We couldn't finish creating your account. Please try again.",
  Callback: "Sign-in didn't complete. Please try again.",
  AccessDenied: "Access was denied. If this seems wrong, tell the person who invited you.",
  Configuration: "Sign-in is temporarily unavailable. We've been notified.",
  Verification: "That sign-in link has expired or was already used. Request a fresh one.",
  EmailSignin: "We couldn't send the email link. Check the address and try again.",
  EmailCreateAccount: "We couldn't set up email sign-in. Please try again.",
  SessionRequired: "Please sign in to continue.",
};

export function authErrorMessage(code: string | undefined | null): string {
  if (!code) return "Sign-in didn't complete. Please try again.";
  return AUTH_ERROR_MESSAGES[code] ?? "Sign-in didn't complete. Please try again.";
}

export async function logAuthEvent(input: {
  code: string;
  email?: string | null;
  detail?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await db.authEvent.create({
      data: {
        code: input.code.slice(0, 80),
        email: (input.email || "").slice(0, 200) || null,
        detail: (input.detail || "").slice(0, 500) || null,
        userAgent: (input.userAgent || "").slice(0, 300) || null,
      },
    });
  } catch {
    /* table not migrated yet — logging is best-effort, never block sign-in */
  }
}

export type AuthFailureRow = {
  id: string;
  code: string;
  email: string | null;
  detail: string | null;
  userAgent: string | null;
  createdAt: Date;
};

// Recent failures + a 24h count for the admin panel's sev2 banner.
export async function recentAuthFailures(limit = 25): Promise<{
  ok: boolean;
  rows: AuthFailureRow[];
  last24h: number;
}> {
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [rows, last24h] = await Promise.all([
      db.authEvent.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
      db.authEvent.count({ where: { createdAt: { gte: dayAgo } } }),
    ]);
    return { ok: true, rows: rows as AuthFailureRow[], last24h };
  } catch {
    return { ok: false, rows: [], last24h: 0 };
  }
}
