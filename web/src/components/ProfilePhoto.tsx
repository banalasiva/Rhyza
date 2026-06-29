"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Avatar } from "@/components/Avatar";

const MAX = 10 * 1024 * 1024; // 10 MB

// The user's avatar with a tap-to-change-photo affordance. Uploads to Vercel
// Blob, then saves the URL to the user's profile.
export function ProfilePhoto({
  name,
  image,
  uploadsEnabled,
  size = 64,
}: {
  name: string;
  image: string | null;
  uploadsEnabled: boolean;
  size?: number;
}) {
  const [img, setImg] = useState<string | null>(image);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!uploadsEnabled) {
      setError("Photo uploads aren't enabled yet (connect a Vercel Blob store).");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please pick an image.");
      return;
    }
    if (file.size > MAX) {
      setError("That image is over 10 MB — pick a smaller one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = await upload(file.name, file, { access: "public", handleUploadUrl: "/api/upload" });
      const res = await fetch("/api/me/photo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: blob.url }),
      });
      if (!res.ok) throw new Error();
      setImg(blob.url);
    } catch {
      setError("Couldn't update your photo.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        title="Change photo"
        aria-label="Change your profile photo"
        className="relative shrink-0 rounded-full transition disabled:opacity-60"
      >
        <Avatar name={name} image={img} size={size} />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#070D07] bg-[#4CAF50] text-[11px]">
          {busy ? "⏳" : "📷"}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
      {error && <span className="max-w-[180px] text-center text-[10px] text-[#e57373]">{error}</span>}
    </div>
  );
}
