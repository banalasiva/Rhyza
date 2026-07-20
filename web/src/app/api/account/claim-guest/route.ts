import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isGuestEmail } from "@/lib/guest";
import { mergeGuestInto } from "@/lib/services/guest-merge";

export const dynamic = "force-dynamic";

const COOKIE = "tt-was-guest";

// Fold a guest's history into the real account they just signed into. The
// secure "tt-was-guest" cookie (set at guest-init) is the proof of ownership —
// only the browser that was that guest holds it — so this can't be used to claim
// someone else's guest content. Provider-agnostic: it only checks "who am I now"
// vs "who was I", never how the sign-in happened.
export async function POST() {
  const guestId = cookies().get(COOKIE)?.value;
  const targetId = (await auth())?.user?.id;

  // No marker, or not signed in → nothing to do.
  if (!guestId || !targetId) return NextResponse.json({ merged: false });
  // Still the guest (not upgraded yet) → keep the marker, do nothing.
  if (guestId === targetId) return NextResponse.json({ merged: false });

  let merged = false;
  try {
    const me = await db.user
      .findUnique({ where: { id: targetId }, select: { email: true } })
      .catch(() => null);
    // Only merge INTO a real (non-guest) account.
    if (me && !isGuestEmail(me.email)) {
      merged = await mergeGuestInto(guestId, targetId);
    }
  } catch (err) {
    console.error("[claim-guest] merge failed", err);
  }
  // Whether it merged or the target turned out non-mergeable, the marker has
  // done its job for this real session — clear it so this runs at most once.
  const res = NextResponse.json({ merged });
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
