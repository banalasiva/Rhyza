import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/authz";

// POST /api/upload — issues a short-lived token so the browser can upload a file
// (image/video/screenshot) straight to Vercel Blob, bypassing the serverless
// body-size limit. Only signed-in users can upload.
export async function POST(request: Request): Promise<NextResponse> {
  // Precise diagnostics so we stop guessing: is the token even in this build?
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "BLOB_READ_WRITE_TOKEN is NOT present in this running deployment. " +
          "Redeploy AFTER adding it, and open the production URL (not a preview build).",
      },
      { status: 400 },
    );
  }
  if (!token.startsWith("vercel_blob_rw_")) {
    return NextResponse.json(
      {
        error:
          "BLOB_READ_WRITE_TOKEN is present but malformed (it should start with " +
          "'vercel_blob_rw_'). Replace its value with the real token from the Blob store.",
      },
      { status: 400 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Throws 401 if not signed in.
        await requireUserId();
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/heic",
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "application/pdf",
          ],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // No-op: the URL is attached to a contribution by the client.
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    );
  }
}
