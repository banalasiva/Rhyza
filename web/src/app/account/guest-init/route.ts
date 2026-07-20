import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isGuestEmail } from "@/lib/guest";

export const dynamic = "force-dynamic";

// A guest lands here right after joining. We stamp a secure, httpOnly marker
// cookie with their guest id — this is the PROOF, later, that whoever holds it
// really was this guest. It's what lets us fold the guest's history into their
// real account when they sign up — no matter how they sign up (Save-your-account
// or just a plain login). Only ever set for an actual guest session.
const COOKIE = "tt-was-guest";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const nextParam = url.searchParams.get("next");
  const next = nextParam && /^\/(?!\/)/.test(nextParam) ? nextParam : "/";
  const res = NextResponse.redirect(new URL(next, url.origin));
  try {
    const id = (await auth())?.user?.id;
    if (id) {
      const me = await db.user
        .findUnique({ where: { id }, select: { email: true } })
        .catch(() => null);
      if (me && isGuestEmail(me.email)) {
        res.cookies.set(COOKIE, id, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
    }
  } catch {
    /* best-effort — a missing marker just means no auto-merge */
  }
  return res;
}
