import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { sendEmail, magicLinkEmailHtml } from "@/lib/email";

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

// Full auth instance (Node runtime): adapter persists users/accounts to Postgres.
// The JWT strategy from authConfig keeps sessions stateless so edge middleware
// can authorize without a DB round-trip.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  ...authConfig,
  providers: [...authConfig.providers, ...emailProviders],
});
