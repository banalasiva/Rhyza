import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { sendEmail, magicLinkEmailHtml } from "@/lib/email";
import { firebaseVerifyConfigured, verifyFirebasePhone } from "@/lib/firebase-verify";
import { verifyPasskeyLogin } from "@/lib/services/passkeys";
import { randomBytes } from "crypto";
import { cleanGuestName, GUEST_EMAIL_DOMAIN } from "@/lib/guest";
import { getInviteByToken, acceptInvite } from "@/lib/services/invites";
import { enforceRateLimit } from "@/lib/ratelimit";

// Passwordless email sign-in (magic link) — a no-Google way in, with no new
// vendor: it reuses our existing Resend setup. Added ONLY here (the Node
// instance with the adapter), never in the edge-safe authConfig the middleware
// builds from — an adapter-requiring provider on the edge instance would crash
// auth entirely. Gated on RESEND_API_KEY so it simply doesn't appear when email
// isn't configured.
const emailProviders = process.env.RESEND_API_KEY
  ? [
      Resend({
        apiKey: process.env.RESEND_API_KEY.trim(),
        from: (process.env.RESEND_FROM || "ThinkThru <onboarding@resend.dev>").trim(),
        name: "Email",
        // Send our own branded magic-link email instead of Auth.js's plain
        // default, reusing the same garden-themed shell as every other email.
        async sendVerificationRequest({ identifier, url }) {
          const ok = await sendEmail({
            to: identifier,
            subject: "Your ThinkThru sign-in link 🌿",
            html: magicLinkEmailHtml({ link: url }),
          });
          if (!ok) throw new Error("Failed to send sign-in email");
        },
      }),
    ]
  : [];

// Phone sign-in (Firebase Phone Auth) — Telegram-style "number + code, you're
// in". The OTP send/confirm happens client-side via the Firebase SDK; this
// provider only VERIFIES the resulting ID token (with jose against Google's
// public keys — no firebase-admin, no service account) and signs the person in.
// Added ONLY here (Node instance), like Resend, since authorize() touches
// Postgres. Gated on the Firebase project id so it's absent until configured —
// and there's no SMS-gateway KYC to clear.
const phoneProviders = firebaseVerifyConfigured()
  ? [
      Credentials({
        id: "phone",
        name: "Phone",
        credentials: { idToken: {} },
        authorize: async (creds) => {
          const idToken = String(creds?.idToken ?? "");
          // Only a token Google actually signed passes; the phone number comes
          // from the verified token, never from the client.
          const phone = await verifyFirebasePhone(idToken);
          if (!phone) return null;
          // Identity is keyed by a synthetic email so phone sign-in works with
          // zero schema change (email is the existing unique key). The
          // phone_identities row is an auxiliary lookup for the future contact
          // graph — written best-effort so a missing table never blocks login.
          const digits = phone.replace(/\D/g, "");
          const email = `phone_${digits}@phone.thinkthru.app`;
          const user = await db.user.upsert({
            where: { email },
            update: { lastActiveAt: new Date() },
            create: { email, name: "" },
            select: { id: true, email: true, name: true, image: true },
          });
          await db
            .$executeRaw`INSERT INTO phone_identities ("phone", "user_id") VALUES (${phone}, ${user.id}::uuid) ON CONFLICT ("phone") DO NOTHING`
            .catch(() => {});
          return { id: user.id, email: user.email, name: user.name, image: user.image };
        },
      }),
    ]
  : [];

// Passkey sign-in (WebAuthn) — Face ID / fingerprint / device unlock, the
// Firebase-free, SMS-free way in. The browser runs the ceremony against our
// /api/passkeys routes; this provider only VERIFIES the resulting assertion
// (against the stored credential's public key) and signs the person in, so a
// success mints a normal JWT session like every other provider. Always on — it
// needs no external service, no keys, no per-message cost. Added ONLY on the
// Node instance (authorize() touches Postgres), never in the edge authConfig.
const passkeyProvider = Credentials({
  id: "passkey",
  name: "Passkey",
  credentials: { challengeId: {}, response: {} },
  authorize: async (creds) => {
    const challengeId = String(creds?.challengeId ?? "");
    let response: unknown = null;
    try {
      response = JSON.parse(String(creds?.response ?? "null"));
    } catch {
      return null;
    }
    if (!challengeId || !response) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await verifyPasskeyLogin(challengeId, response as any);
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, image: user.image };
  },
});

// Guest sign-in — a name-only, no-Google way in, minted ONLY through a valid
// invite (someone vouched for them). It creates a lightweight user with a
// synthetic @guest email (the marker that gates AI, seed/garden creation, and
// posting outside invited seeds), joins them to what they were invited to, and
// signs them in. Rate-limited by IP so a script can't mass-mint guests. Always
// available (no external service). Node instance only (touches Postgres).
const guestProvider = Credentials({
  id: "guest",
  name: "Guest",
  credentials: { name: {}, inviteToken: {} },
  authorize: async (creds, request) => {
    const name = cleanGuestName(String(creds?.name ?? ""));
    const token = String(creds?.inviteToken ?? "").trim();
    // No invite → no guest account (they can still read public seeds anonymously).
    if (!name || !token) return null;
    // Cap guest creation per IP (fail-open on limiter infra errors).
    const ip =
      (request as Request | undefined)?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    await enforceRateLimit(`guest-new:${ip}`, 10, 3600);
    // The invite must be real and live BEFORE we create anything.
    const invite = await getInviteByToken(token);
    if (!invite || invite.expired || invite.status === "revoked") return null;
    const email = `guest_${randomBytes(9).toString("hex")}${GUEST_EMAIL_DOMAIN}`;
    const user = await db.user.create({
      data: { email, name },
      select: { id: true, email: true, name: true, image: true },
    });
    // Join what they were invited to (an open link drops them straight in).
    await acceptInvite(user.id, user.email, token).catch(() => {});
    return { id: user.id, email: user.email, name: user.name, image: user.image };
  },
});

// Full auth instance (Node runtime): adapter persists users/accounts to Postgres.
// The JWT strategy from authConfig keeps sessions stateless so edge middleware
// can authorize without a DB round-trip.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  ...authConfig,
  providers: [
    ...authConfig.providers,
    ...emailProviders,
    ...phoneProviders,
    passkeyProvider,
    guestProvider,
  ],
});
