import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({ url: z.string().url().max(2000) });

// PATCH /api/me/photo — set the signed-in user's profile photo. Only accepts a
// URL from our own Vercel Blob store (uploaded via /api/upload).
export const PATCH = handle(async (req) => {
  const userId = await requireUserId();
  const { url } = schema.parse(await req.json());
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    /* fall through to the check below */
  }
  if (!host.endsWith(".blob.vercel-storage.com")) {
    throw new ApiError("BAD_REQUEST", "Invalid image URL.");
  }
  await db.user.update({ where: { id: userId }, data: { image: url } });
  return ok({ image: url });
});
