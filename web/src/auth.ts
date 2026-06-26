import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";

// Full auth instance (Node runtime): adapter persists users/accounts to Postgres.
// The JWT strategy from authConfig keeps sessions stateless so edge middleware
// can authorize without a DB round-trip.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  ...authConfig,
});
