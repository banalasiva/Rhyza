"use client";

// WhatsApp-style client-side image compression. A phone photo is often 5–12 MB;
// re-encoding it to a sensible max edge + JPEG quality in the browser drops it to
// ~200–500 KB BEFORE it ever leaves the device — so uploads (and later
// downloads) are many times faster on mobile data, with no visible quality loss
// at the sizes we display. Non-photos (video, pdf, gif) and anything that fails
// to decode are returned untouched, so nothing is ever lost by trying.
const MAX_EDGE = 1600; // longest side, px — plenty for full-width display
const QUALITY = 0.82; // JPEG quality — the WhatsApp-ish sweet spot

export async function compressImage(file: File): Promise<File> {
  // Only re-encode static raster photos. Skip gif (would kill animation) and
  // non-images; heic frequently can't be decoded by canvas, and the try/catch
  // below quietly falls back to the original if decoding fails.
  if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", QUALITY),
    );
    // If re-encoding didn't actually shrink it (already tiny/optimized), keep the
    // original so we never make a file bigger.
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.(png|webp|jpe?g|heic)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
