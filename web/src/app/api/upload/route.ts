import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/authz";

// POST /api/upload — issues a short-lived token so the browser can upload a file
// (image/video/screenshot) straight to Vercel Blob, bypassing the serverless
// body-size limit. Only signed-in users can upload.
export async function POST(request: Request): Promise<NextResponse> {
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
