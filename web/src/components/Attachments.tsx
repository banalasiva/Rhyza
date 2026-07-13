"use client";

export type Attachment = { url: string; type: "image" | "video" | "file"; name?: string };

// Save a remote file to the device. Vercel Blob URLs are cross-origin, so the
// plain `download` attribute is ignored by browsers — we fetch the bytes and
// download via an object URL, which works cross-origin on desktop and Android.
// On anything where that fails (iOS Safari is finicky), fall back to opening the
// file so the user can long-press → Save.
async function saveFile(url: string, name?: string) {
  const filename = name || url.split("/").pop()?.split("?")[0] || "download";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

// Renders a contribution's attachments: images inline (tap to open, or Save),
// videos with controls, anything else as a download chip.
export function Attachments({ items }: { items: Attachment[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {items.map((a, i) => {
        if (a.type === "image") {
          return (
            <div key={i} className="relative">
              {/* Tap opens the full image (where a long-press can also save). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={a.url} target="_blank" rel="noreferrer">
                <img
                  src={a.url}
                  alt={a.name || "attachment"}
                  className="max-h-64 rounded-xl border border-[rgba(255,255,255,0.08)] object-cover"
                />
              </a>
              {/* Explicit, reliable save — downloads the bytes directly. */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void saveFile(a.url, a.name);
                }}
                aria-label="Save image"
                title="Save image"
                className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition hover:bg-black/75 active:scale-95"
              >
                <span aria-hidden>⬇</span> Save
              </button>
            </div>
          );
        }
        if (a.type === "video") {
          return (
            <div key={i} className="relative w-full max-w-md">
              <video
                src={a.url}
                controls
                aria-label={a.name || "Attached video"}
                className="max-h-72 w-full rounded-xl border border-[rgba(255,255,255,0.08)]"
              >
                {/* Captions slot — uploaders can add a caption track in a later
                    feature; present so assistive tech exposes the affordance. */}
                <track kind="captions" />
              </video>
              <button
                type="button"
                onClick={() => void saveFile(a.url, a.name)}
                aria-label="Save video"
                title="Save video"
                className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition hover:bg-black/75 active:scale-95"
              >
                <span aria-hidden>⬇</span> Save
              </button>
            </div>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => void saveFile(a.url, a.name)}
            className="inline-flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-xs text-ink-mid transition hover:text-ink"
          >
            📎 {a.name || "Attachment"} <span aria-hidden>⬇</span>
          </button>
        );
      })}
    </div>
  );
}
