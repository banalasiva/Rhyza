import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge middleware uses the adapter-free config so it stays on the edge runtime.
// The `authorized` callback in authConfig decides what requires a session.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except static assets and image optimization.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
