import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

// GET /api/debug/blob — read-only-ish diagnostics (no secrets). Now it actually
// TESTS the token: it tries a tiny server-side write to Blob and reports the
// result. writeTest.ok === true means the token is valid and the problem is the
// client upload flow; ok === false means the token itself is rejected (error
// shows why). serverTime must change each refresh (else it's a cached view).
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const t = process.env.BLOB_READ_WRITE_TOKEN ?? "";

  let writeTest: { ok: boolean; url?: string; error?: string };
  try {
    const r = await put("debug/_healthcheck.txt", "ok", {
      access: "public",
      addRandomSuffix: false,
      contentType: "text/plain",
    });
    writeTest = { ok: true, url: r.url };
  } catch (e) {
    writeTest = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json(
    {
      serverTime: new Date().toISOString(),
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local/unknown",
      blobTokenPresent: t.length > 0,
      blobTokenPrefix: t ? t.slice(0, 14) : null,
      blobTokenLength: t.length,
      blobStoreIdPresent: !!process.env.BLOB_STORE_ID,
      writeTest, // ← the real answer: can this token write to Blob?
    },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}
