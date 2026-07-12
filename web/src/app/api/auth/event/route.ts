import { NextResponse } from "next/server";
import { z } from "zod";
import { logAuthEvent } from "@/lib/services/auth-events";
import { enforceRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// POST /api/auth/event — record a sign-in failure so the owner sees it on the
// admin panel. Public (the person isn't signed in when auth fails) and rate-
// limited so it can't be spammed into a log flood. Best-effort: any failure
// here is swallowed — logging must never get in the way of trying to sign in.
const schema = z.object({
  code: z.string().min(1).max(80),
  email: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    await enforceRateLimit(`authevent:${ip}`, 20, 300); // 20 per 5 min per IP

    const body = schema.parse(await req.json());
    await logAuthEvent({
      code: body.code,
      email: body.email,
      userAgent: req.headers.get("user-agent"),
    });
  } catch {
    /* rate-limited or malformed — ignore */
  }
  // Always 200 so the client never surfaces a logging error to the user.
  return NextResponse.json({ ok: true });
}
