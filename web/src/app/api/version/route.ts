import { NextResponse } from "next/server";

// GET /api/version — the commit the *currently deployed* server is running. The
// client compares this to the build it was loaded with and reloads when a newer
// version is live, so nobody gets stuck on a stale bundle (installed PWAs love
// to resume old code from memory).
export function GET() {
  // Identical for every client and only changes on deploy, yet it's polled by
  // every open tab every 60s. Let the CDN/edge serve it so 1M clients don't each
  // hit the function — a short shared cache + SWR keeps it fresh enough to still
  // trigger the "new version, reload" flow within a minute or two.
  return NextResponse.json(
    { v: process.env.VERCEL_GIT_COMMIT_SHA || "dev" },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60" } },
  );
}
