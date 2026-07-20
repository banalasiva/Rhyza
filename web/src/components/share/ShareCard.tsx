"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";

// Wraps a card visual and turns it into a downloadable / shareable PNG. The
// captured node is `ref`; the buttons sit outside it so they never appear in the
// image. pixelRatio 2 = crisp on retina / when zoomed.
export function ShareCard({ filename, children }: { filename: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function toBlob(): Promise<Blob | null> {
    if (!ref.current) return null;
    const dataUrl = await toPng(ref.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#070D07",
    });
    return (await fetch(dataUrl)).blob();
  }

  function save(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function download() {
    setBusy(true);
    try {
      const blob = await toBlob();
      if (blob) save(blob);
    } catch (err) {
      console.error("share card render failed", err);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    try {
      const blob = await toBlob();
      if (!blob) return;
      const file = new File([blob], `${filename}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text: "My ThinkThru 🌱 thinkthru.app" });
      } else {
        save(blob); // no file-share support → just download
      }
    } catch {
      /* user cancelled the share sheet */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={ref}>{children}</div>
      <div className="flex gap-2">
        <button onClick={download} disabled={busy} className="btn-ghost text-sm disabled:opacity-50">
          {busy ? "Rendering…" : "⬇ Download PNG"}
        </button>
        <button onClick={share} disabled={busy} className="btn-primary text-sm disabled:opacity-50">
          Share
        </button>
      </div>
    </div>
  );
}
