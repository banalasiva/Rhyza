import { NextResponse } from "next/server";

// GET /api/debug/blob — read-only diagnostics (no secrets). Open in a browser.
// `serverTime` changes every request UNLESS your browser is showing a cached
// copy (the likely reason it looks frozen). `commit` confirms which build is
// live; the token length/prefix reveals a missing or truncated token.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const t = process.env.BLOB_READ_WRITE_TOKEN ?? "";
  return NextResponse.json(
    {
      serverTime: new Date().toISOString(), // must change each refresh
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local/unknown",
      deployedRegion: process.env.VERCEL_REGION ?? null,
      blobTokenPresent: t.length > 0,
      blobTokenPrefix: t ? t.slice(0, 14) : null,
      blobTokenLength: t.length, // real token ~90-130; 62 = truncated
      blobStoreIdPresent: !!process.env.BLOB_STORE_ID,
    },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}
