import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { sendEmail, magicLinkEmailHtml } from "@/lib/email";
import { twilioConfigured, checkVerification, normalizeE164 } from "@/lib/twilio";

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

// Phone sign-in (Twilio Verify) — Telegram-style "number + code, you're in".
// Added ONLY here (Node instance), like Resend: authorize() touches Postgres and
// calls Twilio, neither of which is edge-safe. Gated on the Twilio env so it's
// absent until configured. The step-1 "send code" call lives in the /login
// server action; this provider only runs the final check-and-sign-in.
const phoneProviders = twilioConfigured()
  ? [
      Credentials({
        id: "phone",
        name: "Phone",
        credentials: { phone: {}, code: {} },
        authorize: async (creds) => {
          const phone = normalizeE164(String(creds?.phone ?? ""));
          const code = String(creds?.code ?? "").trim();
          if (!phone || !code) return null;
          // Only Twilio's "approved" lets someone in — never trust the client.
          const approved = await checkVerification(phone, code);
          if (!approved) return null;
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

// Full auth instance (Node runtime): adapter persists users/accounts to Postgres.
// The JWT strategy from authConfig keeps sessions stateless so edge middleware
// can authorize without a DB round-trip.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  ...authConfig,
  providers: [...authConfig.providers, ...emailProviders, ...phoneProviders],
});
