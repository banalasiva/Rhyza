import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isGuestEmail } from "@/lib/guest";
import { mergeGuestInto } from "@/lib/services/guest-merge";

export const dynamic = "force-dynamic";

// Where a guest lands right AFTER upgrading via any provider (Google, email,
// …). Provider-agnostic by design: it doesn't care how they signed in, only
// that (a) a "tt-merge-from" cookie holds the guest id they were, and (b) they
// are now a real account. If so, it folds the guest's history into the real
// account, then sends them on. The cookie is set when the upgrade begins.
const COOKIE = "tt-merge-from";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const nextParam = url.searchParams.get("next");
  const next = nextParam && /^\/(?!\/)/.test(nextParam) ? nextParam : "/";
  const res = NextResponse.redirect(new URL(next, url.origin));
  // Always clear the one-shot cookie, whatever happens.
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });

  try {
    const session = await auth();
    const targetId = session?.user?.id;
    const guestId = cookies().get(COOKIE)?.value;
    if (targetId && guestId && guestId !== targetId) {
      // The current session must be a REAL account (the guest just upgraded).
      const me = await db.user
        .findUnique({ where: { id: targetId }, select: { email: true } })
        .catch(() => null);
      if (me && !isGuestEmail(me.email)) {
        await mergeGuestInto(guestId, targetId);
      }
    }
  } catch (err) {
    console.error("[account/claim] merge failed", err);
  }
  return res;
}
