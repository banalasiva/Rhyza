import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/version — the commit the *currently deployed* server is running. The
// client compares this to the build it was loaded with and reloads when a newer
// version is live, so nobody gets stuck on a stale bundle (installed PWAs love
// to resume old code from memory).
export function GET() {
  return NextResponse.json(
    { v: process.env.VERCEL_GIT_COMMIT_SHA || "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
