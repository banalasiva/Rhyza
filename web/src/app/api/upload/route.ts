import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/authz";

// POST /api/upload — issues a short-lived token so the browser can upload a file
// (image/video/screenshot) straight to Vercel Blob, bypassing the serverless
// body-size limit. Only signed-in users can upload.
export async function POST(request: Request): Promise<NextResponse> {
  // Authenticate FIRST — never reveal env/secret state to anonymous callers.
  try {
    await requireUserId();
  } catch {
    return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Uploads aren't available right now." }, { status: 503 });
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
            "image/heif",
            // Broad video coverage so real phone/desktop videos upload (mp4 +
            // iPhone .mov + webm play inline; the rest still upload + download).
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "video/x-matroska",
            "video/x-msvideo",
            "video/mpeg",
            "video/3gpp",
            "video/ogg",
            "application/pdf",
          ],
          // Real videos are big — 100 MB was too small. Default 500 MB, raise via
          // MAX_UPLOAD_MB if you need more (Vercel Blob supports up to 5 TB).
          maximumSizeInBytes: (Number(process.env.MAX_UPLOAD_MB) || 500) * 1024 * 1024,
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
