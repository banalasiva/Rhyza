import { NextResponse } from "next/server";

// GET /api/debug/blob — read-only diagnostics (no secrets exposed) so we can see
// exactly what the LIVE deployment has, instead of guessing from upload errors.
// Open this URL in a browser. `commit` confirms which build is live; the token
// length/prefix reveals a missing or truncated BLOB_READ_WRITE_TOKEN.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const t = process.env.BLOB_READ_WRITE_TOKEN ?? "";
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local/unknown",
    deployedRegion: process.env.VERCEL_REGION ?? null,
    blobTokenPresent: t.length > 0,
    blobTokenPrefix: t ? t.slice(0, 14) : null, // "vercel_blob_rw_" if valid
    blobTokenLength: t.length, // a real token is ~90+ chars; short = truncated
    blobStoreIdPresent: !!process.env.BLOB_STORE_ID,
  });
}
