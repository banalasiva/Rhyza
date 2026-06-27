"use client";

export type Attachment = { url: string; type: "image" | "video" | "file"; name?: string };

// Renders a contribution's attachments: images inline, videos with controls,
// anything else as a download chip.
export function Attachments({ items }: { items: Attachment[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {items.map((a, i) => {
        if (a.type === "image") {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={i} href={a.url} target="_blank" rel="noreferrer">
              <img
                src={a.url}
                alt={a.name || "attachment"}
                className="max-h-64 rounded-xl border border-[rgba(255,255,255,0.08)] object-cover"
              />
            </a>
          );
        }
        if (a.type === "video") {
          return (
            <video
              key={i}
              src={a.url}
              controls
              className="max-h-72 w-full max-w-md rounded-xl border border-[rgba(255,255,255,0.08)]"
            />
          );
        }
        return (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-xs text-ink-mid transition hover:text-ink"
          >
            📎 {a.name || "Attachment"}
          </a>
        );
      })}
    </div>
  );
}
