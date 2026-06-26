import type { DefaultSession } from "next-auth";

// Augment the session so `session.user.id` is available and typed everywhere.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
