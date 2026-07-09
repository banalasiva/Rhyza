// Shareable visual cards — the distribution engine. A tap turns a daily question
// or a bloomed decision into a clean, branded image the person can drop straight
// into a WhatsApp family group or an Instagram story. We "ride the giants":
// ThinkThru travels on the platforms people already open all day.
//
// Pure canvas + navigator.share — no new dependencies, no server round-trip. On
// browsers without file sharing we fall back to a plain download.

export type ShareCardSpec = {
  eyebrow?: string; // small label at the top, e.g. "Daily Question"
  title: string; // the hero line — the question, or the decision
  lines?: string[]; // optional supporting lines (results, options, a subtitle)
  footer?: string; // small line at the very bottom (defaults to the site)
  accent?: "green" | "bloom"; // colour theme
};

const W = 1080;
const H = 1350; // 4:5 — the sweet spot for both feed and stories

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Word-wrap `text` to `maxWidth`, returning the lines. Used for the hero copy.
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Render the card to a canvas and return it as a PNG blob.
export async function renderShareCard(spec: ShareCardSpec): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const bloom = spec.accent === "bloom";

  // Warm garden gradient background.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  if (bloom) {
    bg.addColorStop(0, "#fff7f2");
    bg.addColorStop(1, "#ffe8d6");
  } else {
    bg.addColorStop(0, "#f3f9f0");
    bg.addColorStop(1, "#e2f0dc");
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const margin = 96;
  const accentColor = bloom ? "#e07a3f" : "#4c9a4e";
  const ink = "#20301f";
  const inkSoft = "#5c6b58";

  // Brand mark — a small pill top-left.
  ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const brand = "🌱 ThinkThru";
  const brandW = ctx.measureText(brand).width + 56;
  ctx.fillStyle = bloom ? "rgba(224,122,63,0.12)" : "rgba(76,154,78,0.12)";
  roundRect(ctx, margin, margin, brandW, 72, 36);
  ctx.fill();
  ctx.fillStyle = accentColor;
  ctx.textBaseline = "middle";
  ctx.fillText(brand, margin + 28, margin + 38);

  // Eyebrow.
  let y = margin + 72 + 96;
  if (spec.eyebrow) {
    ctx.font = "600 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = accentColor;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(spec.eyebrow.toUpperCase(), margin, y);
    y += 72;
  }

  // Hero title — big serif-ish, wrapped, size shrinks for long text.
  const maxWidth = W - margin * 2;
  let titleSize = spec.title.length > 90 ? 68 : spec.title.length > 50 ? 82 : 96;
  ctx.font = `700 ${titleSize}px Georgia, "Times New Roman", serif`;
  let titleLines = wrap(ctx, `“${spec.title}”`, maxWidth);
  // If it runs very long, step the size down until it fits a sensible height.
  while (titleLines.length > 6 && titleSize > 52) {
    titleSize -= 6;
    ctx.font = `700 ${titleSize}px Georgia, "Times New Roman", serif`;
    titleLines = wrap(ctx, `“${spec.title}”`, maxWidth);
  }
  ctx.fillStyle = ink;
  const titleLH = Math.round(titleSize * 1.24);
  y += titleSize;
  for (const line of titleLines) {
    ctx.fillText(line, margin, y);
    y += titleLH;
  }

  // Supporting lines (e.g. tally results) — rendered as soft rows.
  if (spec.lines && spec.lines.length) {
    y += 40;
    ctx.font = "500 46px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    for (const line of spec.lines) {
      ctx.fillStyle = inkSoft;
      ctx.fillText(line, margin, y);
      y += 74;
    }
  }

  // Footer, pinned to the bottom.
  ctx.font = "500 38px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = inkSoft;
  ctx.fillText(spec.footer ?? "Think it through together · thinkthru.app", margin, H - margin);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to render"))), "image/png");
  });
}

// Render, then share the image via the native sheet (WhatsApp, Instagram, etc.).
// Falls back to a download if the browser can't share files. Returns how it went
// so the UI can show the right confirmation.
export async function shareCard(
  spec: ShareCardSpec,
  opts?: { fileName?: string; shareText?: string },
): Promise<"shared" | "downloaded"> {
  const blob = await renderShareCard(spec);
  const fileName = opts?.fileName ?? "thinkthru.png";
  const file = new File([blob], fileName, { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        text: opts?.shareText,
      });
      return "shared";
    } catch (err) {
      // User cancelled the native sheet — treat as a no-op, not a failure.
      if ((err as Error)?.name === "AbortError") return "shared";
      /* fall through to download */
    }
  }

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  return "downloaded";
}
