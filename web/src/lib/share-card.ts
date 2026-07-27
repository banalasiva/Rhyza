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

// ── The Bloom Card ──────────────────────────────────────────────────────────
// A narrative card, not a stats dump. One seed, one bloom, one human truth. The
// design rule is absolute: the INSIGHT is the largest thing on the card — bigger
// than the brand, the question, or the credit. People share it because the idea
// looks good, and that makes them look good for having grown it. ThinkThru rides
// quietly in the corner. If the brand were the hero, nobody would share it.

export type BloomCardSpec = {
  question: string; // the seed question — context, secondary
  insight: string; // the distilled bloom — THE HERO, the largest thing here
  stat?: string; // "6 people explored it · 3 dimensions lit up"
  credit?: string; // "Siva was credited · Opened it up"
  footer?: string;
};

function truncateCard(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export async function renderBloomCard(spec: BloomCardSpec): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Warm bloom gradient.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#fff7f2");
  bg.addColorStop(1, "#ffe8d6");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const margin = 96;
  const accent = "#e07a3f";
  const ink = "#20301f";
  const inkSoft = "#5c6b58";
  const maxW = W - margin * 2;

  // Brand mark — a small, quiet pill. Deliberately NOT the hero.
  ctx.textBaseline = "middle";
  ctx.font = "600 32px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const brand = "🌱 ThinkThru";
  const brandW = ctx.measureText(brand).width + 52;
  ctx.fillStyle = "rgba(224,122,63,0.12)";
  roundRect(ctx, margin, margin, brandW, 66, 33);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillText(brand, margin + 26, margin + 34);
  ctx.textBaseline = "alphabetic";

  // Eyebrow.
  let y = margin + 66 + 84;
  ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText("A DECISION, BLOOMED", margin, y);

  // Question — context, secondary. Italic serif, soft ink, capped length.
  y += 70;
  const question = truncateCard(spec.question, 160);
  ctx.font = "italic 44px Georgia, \"Times New Roman\", serif";
  ctx.fillStyle = inkSoft;
  const qLines = wrap(ctx, `“${question}”`, maxW).slice(0, 3);
  const qLH = 60;
  for (const line of qLines) {
    ctx.fillText(line, margin, y);
    y += qLH;
  }
  const questionEnd = y;

  // ── Bottom zone (measured up from the base) so the hero knows its ceiling ──
  const footerY = H - margin; // footer baseline
  let bottomStart = footerY - 44; // above the footer line

  // Credit chip — an accent pill, drawn just above the footer if present.
  const credit = spec.credit ? truncateCard(spec.credit, 64) : "";
  let creditTop = bottomStart;
  if (credit) {
    ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    const label = `🔖 ${credit}`;
    const chipW = Math.min(ctx.measureText(label).width + 56, maxW);
    const chipH = 76;
    creditTop = bottomStart - chipH;
    ctx.fillStyle = "rgba(224,122,63,0.14)";
    roundRect(ctx, margin, creditTop, chipW, chipH, 38);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.textBaseline = "middle";
    ctx.fillText(label, margin + 28, creditTop + chipH / 2 + 2);
    ctx.textBaseline = "alphabetic";
    bottomStart = creditTop - 40;
  }

  // Stat line — soft, above the credit chip.
  if (spec.stat) {
    ctx.font = "500 38px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = inkSoft;
    bottomStart -= 44;
    ctx.fillText(truncateCard(spec.stat, 60), margin, bottomStart);
    bottomStart -= 44;
  }

  // ── Hero: the insight. The largest thing on the card. Fills the space between
  // the question and the bottom zone, shrinking only as far as it must to fit. ──
  const heroTop = questionEnd + 56;
  const heroAvail = bottomStart - heroTop;
  const insight = truncateCard(spec.insight, 240);
  let size = 92;
  let lines: string[] = [];
  let lh = 0;
  for (; size >= 46; size -= 4) {
    ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
    lines = wrap(ctx, insight, maxW);
    lh = Math.round(size * 1.22);
    if (lines.length * lh <= heroAvail) break;
  }
  ctx.fillStyle = ink;
  // Vertically center the hero within its available band for balance.
  let hy = heroTop + Math.max(0, (heroAvail - lines.length * lh) / 2) + size;
  for (const line of lines) {
    ctx.fillText(line, margin, hy);
    hy += lh;
  }

  // Footer — quiet, pinned to the bottom.
  ctx.font = "500 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = inkSoft;
  ctx.fillText(spec.footer ?? "Grown on ThinkThru — where thinking leaves a trace.", margin, footerY);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to render"))), "image/png");
  });
}

// Render a Bloom Card, then share it via the native sheet (WhatsApp, Instagram,
// LinkedIn…), falling back to a download. Returns how it went.
export async function shareBloomCard(
  spec: BloomCardSpec,
  opts?: { fileName?: string; shareText?: string },
): Promise<"shared" | "downloaded"> {
  const blob = await renderBloomCard(spec);
  const fileName = opts?.fileName ?? "thinkthru-bloom.png";
  const file = new File([blob], fileName, { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: opts?.shareText });
      return "shared";
    } catch (err) {
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

// Shared plumbing: turn a rendered blob into a native share (or a download
// fallback), so every card kind shares identically.
async function shareBlob(
  blob: Blob,
  fileName: string,
  shareText?: string,
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], fileName, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: shareText });
      return "shared";
    } catch (err) {
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

// A canvas primitive shared by the fingerprint + calibration cards: a horizontal
// rounded bar split into proportional coloured segments (the "signature" / the
// outcome mix). `segs` are {pct,color}; pcts should sum to ~100.
function signatureBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  segs: { pct: number; color: string }[],
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.clip();
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(x, y, w, h);
  let cx = x;
  for (const s of segs) {
    const segW = (w * s.pct) / 100;
    ctx.fillStyle = s.color;
    ctx.fillRect(cx, y, segW + 1, h); // +1 avoids hairline gaps between segments
    cx += segW;
  }
  ctx.restore();
}

// ── The Thinking Fingerprint Card ───────────────────────────────────────────
// The LinkedIn card: professional identity, not a specific conversation. "Siva
// thinks in Applications." The archetype is the hero; the colour signature is
// the thing that's uniquely theirs. Same design rule — identity is the largest
// thing, brand rides quietly.

export type FingerprintCardSpec = {
  headline: string; // "Siva thinks in Application" — THE HERO
  archetype: string; // "Application thinker"
  emoji: string;
  color: string; // the primary dimension's colour
  blurb: string; // one-line read of the archetype
  slices: { label: string; emoji: string; color: string; pct: number }[];
  footer?: string;
};

export async function renderFingerprintCard(spec: FingerprintCardSpec): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Cool, calm identity gradient (distinct from the warm bloom card).
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#f3f9f0");
  bg.addColorStop(1, "#e6f0ea");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const margin = 96;
  const ink = "#20301f";
  const inkSoft = "#5c6b58";
  const maxW = W - margin * 2;
  const accent = spec.color || "#4c9a4e";

  // Brand pill — quiet.
  ctx.textBaseline = "middle";
  ctx.font = "600 32px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const brand = "🌱 ThinkThru";
  const brandW = ctx.measureText(brand).width + 52;
  ctx.fillStyle = "rgba(76,154,78,0.12)";
  roundRect(ctx, margin, margin, brandW, 66, 33);
  ctx.fill();
  ctx.fillStyle = "#3f7d41";
  ctx.fillText(brand, margin + 26, margin + 34);
  ctx.textBaseline = "alphabetic";

  // Eyebrow.
  let y = margin + 66 + 96;
  ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText("MY THINKING FINGERPRINT", margin, y);

  // Big archetype emoji.
  y += 128;
  ctx.font = "110px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(spec.emoji, margin, y);

  // Hero headline — the identity claim, the largest thing on the card.
  y += 60;
  const insight = truncateCard(spec.headline, 90);
  let size = 92;
  let lines: string[] = [];
  let lh = 0;
  for (; size >= 54; size -= 4) {
    ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
    lines = wrap(ctx, insight, maxW);
    lh = Math.round(size * 1.2);
    if (lines.length <= 3) break;
  }
  ctx.fillStyle = ink;
  y += size;
  for (const line of lines) {
    ctx.fillText(line, margin, y);
    y += lh;
  }

  // Blurb — the one-line read.
  y += 24;
  ctx.font = "400 42px Georgia, \"Times New Roman\", serif";
  ctx.fillStyle = inkSoft;
  for (const line of wrap(ctx, spec.blurb, maxW).slice(0, 3)) {
    ctx.fillText(line, margin, y);
    y += 56;
  }

  // Signature bar + legend, pinned above the footer.
  const footerY = H - margin;
  const legendY = footerY - 130;
  const barY = legendY - 84;
  signatureBar(
    ctx,
    margin,
    barY,
    maxW,
    30,
    spec.slices.map((s) => ({ pct: s.pct, color: s.color })),
  );
  // Legend — a wrapped row of coloured dots + labels + %.
  ctx.font = "500 30px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  let lx = margin;
  let ly = legendY;
  for (const s of spec.slices) {
    const label = `${s.label} ${s.pct}%`;
    const dotW = 34;
    const textW = ctx.measureText(label).width;
    const chunk = dotW + textW + 34;
    if (lx + chunk > margin + maxW) {
      lx = margin;
      ly += 46;
    }
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(lx + 10, ly - 10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = inkSoft;
    ctx.fillText(label, lx + dotW, ly);
    lx += chunk;
  }

  // Footer.
  ctx.font = "500 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = inkSoft;
  ctx.fillText(spec.footer ?? "Grown on ThinkThru — where thinking leaves a trace.", margin, footerY);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to render"))), "image/png");
  });
}

export async function shareFingerprintCard(
  spec: FingerprintCardSpec,
  opts?: { fileName?: string; shareText?: string },
): Promise<"shared" | "downloaded"> {
  const blob = await renderFingerprintCard(spec);
  return shareBlob(blob, opts?.fileName ?? "thinkthru-fingerprint.png", opts?.shareText);
}

// ── The Calibration Card ────────────────────────────────────────────────────
// The most powerful of the three BECAUSE it's earned over real decisions and is
// verifiable in a way no badge is. Opt-in only: the "looking back" mirror is
// private by default; a person chooses to turn their own track record into a
// card. Honest framing — a self-reviewed track record, never a claim of
// externally-graded accuracy. The number is the hero.

export type CalibrationCardSpec = {
  bigNumber: string; // "8 / 11" — THE HERO
  label: string; // "landed as well as I hoped — or better"
  insight?: string; // the judgement read
  segs?: { pct: number; color: string; label: string }[]; // outcome mix, optional
  footer?: string;
};

export async function renderCalibrationCard(spec: CalibrationCardSpec): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#f6f4ff");
  bg.addColorStop(1, "#e9e4fb");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const margin = 96;
  const ink = "#221f33";
  const inkSoft = "#5a5570";
  const accent = "#7c5cff";
  const maxW = W - margin * 2;

  // Brand pill — quiet.
  ctx.textBaseline = "middle";
  ctx.font = "600 32px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const brand = "🌱 ThinkThru";
  const brandW = ctx.measureText(brand).width + 52;
  ctx.fillStyle = "rgba(124,92,255,0.12)";
  roundRect(ctx, margin, margin, brandW, 66, 33);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillText(brand, margin + 26, margin + 34);
  ctx.textBaseline = "alphabetic";

  // Eyebrow.
  let y = margin + 66 + 110;
  ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText("MY JUDGEMENT, LOOKING BACK", margin, y);

  // The big number — the hero.
  y += 250;
  ctx.font = "700 220px Georgia, \"Times New Roman\", serif";
  ctx.fillStyle = ink;
  ctx.fillText(spec.bigNumber, margin, y);

  // Label under the number — a generous gap clears the 220px glyph's baseline.
  y += 88;
  ctx.font = "500 48px Georgia, \"Times New Roman\", serif";
  ctx.fillStyle = ink;
  for (const line of wrap(ctx, spec.label, maxW).slice(0, 3)) {
    ctx.fillText(line, margin, y);
    y += 62;
  }

  // Insight read.
  if (spec.insight) {
    y += 20;
    ctx.font = "400 38px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = inkSoft;
    for (const line of wrap(ctx, spec.insight, maxW).slice(0, 4)) {
      ctx.fillText(line, margin, y);
      y += 52;
    }
  }

  // Outcome mix bar + legend, pinned above the footer.
  const footerY = H - margin;
  if (spec.segs && spec.segs.length) {
    const legendY = footerY - 130;
    const barY = legendY - 84;
    signatureBar(ctx, margin, barY, maxW, 30, spec.segs);
    ctx.font = "500 30px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    let lx = margin;
    const ly = legendY;
    for (const s of spec.segs) {
      if (s.pct <= 0) continue;
      const label = `${s.label} ${Math.round(s.pct)}%`;
      const dotW = 34;
      const chunk = dotW + ctx.measureText(label).width + 34;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(lx + 10, ly - 10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = inkSoft;
      ctx.fillText(label, lx + dotW, ly);
      lx += chunk;
    }
  }

  // Footer.
  ctx.font = "500 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = inkSoft;
  ctx.fillText(spec.footer ?? "A self-reviewed track record · ThinkThru", margin, footerY);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to render"))), "image/png");
  });
}

export async function shareCalibrationCard(
  spec: CalibrationCardSpec,
  opts?: { fileName?: string; shareText?: string },
): Promise<"shared" | "downloaded"> {
  const blob = await renderCalibrationCard(spec);
  return shareBlob(blob, opts?.fileName ?? "thinkthru-calibration.png", opts?.shareText);
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
