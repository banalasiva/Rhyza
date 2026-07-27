// Shareable visual cards — the distribution engine. A tap turns a daily question
// or a bloomed decision into a clean, branded image the person can drop straight
// into a WhatsApp family group or an Instagram story. We "ride the giants":
// ThinkThru travels on the platforms people already open all day.
//
// Canvas + navigator.share, no server round-trip. A scannable QR (qrcode-generator,
// zero runtime deps) is baked onto the bloom card so the image leads back to the
// decision even where text links get stripped (WhatsApp Status, IG Story).

import qrcode from "qrcode-generator";

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

// Draw a scannable QR for `url` at (x,y) filling `size`px, on a white rounded
// tile so it stays high-contrast on any card background. Error-correction level
// M tolerates the tile's rounded corners and light overlay wear. Output is
// verified-scannable (qrcode-generator, decoded back with a real reader in CI).
function drawQr(
  ctx: CanvasRenderingContext2D,
  url: string,
  x: number,
  y: number,
  size: number,
  tile = "#ffffff",
) {
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2; // modules of quiet zone inside the tile
  const cell = size / (n + quiet * 2);
  ctx.fillStyle = tile;
  roundRect(ctx, x, y, size, size, 18);
  ctx.fill();
  ctx.fillStyle = "#20301f";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      const px = x + (c + quiet) * cell;
      const py = y + (r + quiet) * cell;
      // Slight overdraw removes hairline seams between modules at fractional px.
      ctx.fillRect(px, py, cell + 0.6, cell + 0.6);
    }
  }
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

// Trim `text` to a single line no wider than `maxWidth`, adding an ellipsis.
// Used so a long name/credit never overflows its pill or runs under the QR.
function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// Clamp wrapped `lines` to at most `maxLines`, ellipsizing the last kept line so
// content can never spill past a reserved bottom limit. maxLines is floored to 1.
function clampLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxLines: number,
  maxWidth: number,
): string[] {
  const cap = Math.max(1, maxLines);
  if (lines.length <= cap) return lines;
  const kept = lines.slice(0, cap);
  kept[cap - 1] = truncateToWidth(ctx, `${kept[cap - 1].trimEnd()} …`, maxWidth);
  return kept;
}

// ── App visual identity: theme + golden emblem + garden depth ───────────────
// The cards must feel unmistakably like ThinkThru: the SAME dark/light theme the
// user is in, the golden sprouting emblem, and the radial-glow depth the app's
// blooms and sacred tree carry. These helpers paint that shared chrome.

type CardTheme = {
  light: boolean;
  bg: string;
  bgMid: string;
  ink: string;
  inkMid: string;
  inkSoft: string;
  accent: string;
  gold: string;
  greenGlow: string;
  goldGlow: string;
  emblemGlow: string;
  vignette: string;
  track: string; // signature/outcome bar track
  chipBg: string; // gold-tinted pill background
  qrTile: string; // QR tile background (kept high-contrast)
};

const DARK_THEME: CardTheme = {
  light: false,
  bg: "#070d07",
  bgMid: "#0d160d",
  ink: "#e8e4dc",
  inkMid: "#a0a890",
  inkSoft: "#8b937f",
  accent: "#66bb6a",
  gold: "#ffb300",
  greenGlow: "rgba(76,175,80,0.16)",
  goldGlow: "rgba(255,179,0,0.13)",
  emblemGlow: "rgba(255,200,90,0.32)",
  vignette: "rgba(0,0,0,0.42)",
  track: "rgba(255,255,255,0.09)",
  chipBg: "rgba(255,179,0,0.15)",
  qrTile: "#f4f7ee",
};
const LIGHT_THEME: CardTheme = {
  light: true,
  bg: "#f5f6f0",
  bgMid: "#e8ece1",
  ink: "#141a11",
  inkMid: "#333a29",
  inkSoft: "#4d5640",
  accent: "#2e7d32",
  gold: "#b26a00",
  greenGlow: "rgba(46,125,50,0.10)",
  goldGlow: "rgba(178,106,0,0.08)",
  emblemGlow: "rgba(255,200,90,0.30)",
  vignette: "rgba(20,26,17,0.06)",
  track: "rgba(20,26,17,0.08)",
  chipBg: "rgba(178,106,0,0.12)",
  qrTile: "#ffffff",
};

function readTheme(): CardTheme {
  try {
    if (typeof document !== "undefined" && document.documentElement.classList.contains("light")) {
      return LIGHT_THEME;
    }
  } catch {
    /* non-DOM context */
  }
  return DARK_THEME;
}

// The golden sprouting emblem — the app's mark. Loaded once and cached.
let emblemPromise: Promise<HTMLImageElement | null> | null = null;
function loadEmblem(): Promise<HTMLImageElement | null> {
  if (!emblemPromise) {
    emblemPromise = new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = "/emblem.png";
      } catch {
        resolve(null);
      }
    });
  }
  return emblemPromise;
}

// Hex (#rgb / #rrggbb) → rgba() string, for tinted glows behind coloured marks.
function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// A radial glow painted across the whole canvas (transparent past `r`).
function glow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// The app's garden background: base gradient + a green glow up top and a gold
// glow low-right (like garden-bg), then a soft vignette for depth.
function paintBackground(ctx: CanvasRenderingContext2D, t: CardTheme) {
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, t.bg);
  base.addColorStop(1, t.bgMid);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, W * 0.5, -H * 0.06, W * 1.15, t.greenGlow);
  glow(ctx, W * 0.85, H * 1.02, W * 0.95, t.goldGlow);
  const v = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.34, W / 2, H * 0.5, H * 0.75);
  v.addColorStop(0, "transparent");
  v.addColorStop(1, t.vignette);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// Brand mark: the golden emblem over a soft glow (depth), with the wordmark.
// Returns the y at the emblem's baseline so callers can flow beneath it.
function paintBrand(ctx: CanvasRenderingContext2D, t: CardTheme, emblem: HTMLImageElement | null) {
  const margin = 96;
  const size = 92;
  glow(ctx, margin + size / 2, margin + size / 2, size * 1.15, t.emblemGlow);
  if (emblem) ctx.drawImage(emblem, margin, margin, size, size);
  ctx.textBaseline = "middle";
  ctx.font = "700 46px Georgia, \"Times New Roman\", serif";
  ctx.fillStyle = t.ink;
  ctx.fillText("ThinkThru", margin + size + 22, margin + size / 2 + 3);
  ctx.textBaseline = "alphabetic";
  return margin + size;
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
  grownBy?: string; // "Grown by Siva, Priya & 4 others" — the collective, named
  stat?: string; // "6 people · 3 dimensions · one decision"
  credit?: string; // "Siva · Opened it up"
  url?: string; // deep link to the bloom → baked into the QR
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

  // App chrome — the user's theme, the golden emblem, garden-glow depth.
  const t = readTheme();
  const emblem = await loadEmblem();
  paintBackground(ctx, t);
  const brandBottom = paintBrand(ctx, t, emblem);

  const margin = 96;
  const accent = t.gold; // the bloom is golden
  const ink = t.ink;
  const inkSoft = t.inkSoft;
  const maxW = W - margin * 2;

  // Eyebrow — framed as collective, because that's the whole point.
  let y = brandBottom + 82;
  ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText("WHAT WE DECIDED TOGETHER", margin, y);

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

  // ── Bottom band (QR bottom-right; credit + footer bottom-left) ─────────────
  const footerY = H - margin;
  const qrSize = 196;
  const qrX = W - margin - qrSize;
  const qrY = H - margin - qrSize - 70; // room for a label beneath, clear of footer
  const leftColW = (spec.url ? qrX - 28 : W - margin) - margin; // keep clear of the QR

  // Credit chip — accent pill just above the footer. The label is truncated to
  // the pill's max width (pixels, not chars) so it never runs under the QR.
  const credit = spec.credit ? spec.credit.trim() : "";
  let bandTop = footerY;
  if (credit) {
    ctx.font = "600 30px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    const label = truncateToWidth(ctx, `🔖 ${credit}`, leftColW - 52);
    const chipW = ctx.measureText(label).width + 52;
    const chipH = 72;
    const chipTop = footerY - 46 - chipH;
    ctx.fillStyle = t.chipBg;
    roundRect(ctx, margin, chipTop, chipW, chipH, 36);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.textBaseline = "middle";
    ctx.fillText(label, margin + 26, chipTop + chipH / 2 + 2);
    ctx.textBaseline = "alphabetic";
    bandTop = chipTop;
  }
  bandTop = Math.min(bandTop, spec.url ? qrY : bandTop);

  // Stat + "grown by" — the collective, stacked just above the band.
  let midBottom = bandTop - 34;
  if (spec.stat) {
    ctx.font = "500 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = inkSoft;
    ctx.fillText(truncateToWidth(ctx, spec.stat, maxW), margin, midBottom);
    midBottom -= 52;
  }
  if (spec.grownBy) {
    ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = ink;
    ctx.fillText(truncateToWidth(ctx, spec.grownBy, maxW), margin, midBottom);
    midBottom -= 44;
  }

  // ── Hero: the insight. The largest thing on the card. Fills the space between
  // the question and the collective band, shrinking only as far as it must. ──
  const heroTop = questionEnd + 52;
  const heroAvail = midBottom - 24 - heroTop;
  const insight = truncateCard(spec.insight, 240);
  let size = 92;
  let lines: string[] = [];
  let lh = 0;
  for (; size >= 44; size -= 4) {
    ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
    lines = wrap(ctx, insight, maxW);
    lh = Math.round(size * 1.22);
    if (lines.length * lh <= heroAvail) break;
  }
  // Safety clamp: if even the floor size overflows, drop excess lines (ellipsized)
  // so the hero can never spill into the collective band below it.
  lines = clampLines(ctx, lines, Math.floor(heroAvail / lh), maxW);
  ctx.save();
  if (!t.light) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
  }
  ctx.fillStyle = ink;
  let hy = heroTop + Math.max(0, (heroAvail - lines.length * lh) / 2) + size;
  for (const line of lines) {
    ctx.fillText(line, margin, hy);
    hy += lh;
  }
  ctx.restore();

  // QR + label — the way back to the decision, surviving image-only shares.
  if (spec.url) {
    // Soft drop shadow under the tile for depth, then the (non-shadowed) QR.
    ctx.save();
    ctx.shadowColor = t.light ? "rgba(20,26,17,0.18)" : "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = t.qrTile;
    roundRect(ctx, qrX, qrY, qrSize, qrSize, 18);
    ctx.fill();
    ctx.restore();
    drawQr(ctx, spec.url, qrX, qrY, qrSize, t.qrTile);
    ctx.font = "500 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = inkSoft;
    ctx.textAlign = "center";
    ctx.fillText("Scan to read & join", qrX + qrSize / 2, qrY + qrSize + 34);
    ctx.textAlign = "left";
  }

  // Footer — quiet, short, pinned bottom-left so it never runs under the QR.
  ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = inkSoft;
  ctx.fillText(spec.footer ?? "thinkthru.app", margin, footerY);

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
  track = "rgba(0,0,0,0.06)",
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.clip();
  ctx.fillStyle = track;
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

  // App chrome — the user's theme, the golden emblem, garden-glow depth.
  const t = readTheme();
  const emblem = await loadEmblem();
  paintBackground(ctx, t);
  const brandBottom = paintBrand(ctx, t, emblem);

  const margin = 96;
  const ink = t.ink;
  const inkSoft = t.inkSoft;
  const maxW = W - margin * 2;
  const accent = spec.color || t.accent;

  // Eyebrow.
  let y = brandBottom + 96;
  ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = t.accent;
  ctx.fillText("MY THINKING FINGERPRINT", margin, y);

  // Big archetype emoji, over a soft glow in its own colour for depth.
  y += 128;
  glow(ctx, margin + 46, y - 38, 150, `${hexToRgba(accent, t.light ? 0.16 : 0.22)}`);
  ctx.font = "110px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(spec.emoji, margin, y);

  // Bottom zone (bar + legend), pinned above the footer.
  const footerY = H - margin;
  const legendY = footerY - 130;
  const barY = legendY - 84;

  // Blurb measured first so the headline can reserve room for it and never
  // collide with the signature bar, however long the name is.
  ctx.font = "400 42px Georgia, \"Times New Roman\", serif";
  const blurbLines = wrap(ctx, spec.blurb, maxW).slice(0, 3);
  const blurbH = blurbLines.length * 56;

  // Hero headline — the identity claim, the largest thing on the card. Fit it
  // into the space above the blurb + bar, shrinking then clamping as needed.
  const headlineTop = y + 60; // gap under the emoji
  const headlineAvail = barY - 56 - blurbH - 28 - headlineTop;
  const insight = truncateCard(spec.headline, 90);
  let size = 92;
  let lines: string[] = [];
  let lh = 0;
  for (; size >= 46; size -= 4) {
    ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
    lines = wrap(ctx, insight, maxW);
    lh = Math.round(size * 1.2);
    if (lines.length * lh <= headlineAvail) break;
  }
  lines = clampLines(ctx, lines, Math.floor(headlineAvail / lh), maxW);
  ctx.fillStyle = ink;
  let hy = headlineTop + size;
  for (const line of lines) {
    ctx.fillText(line, margin, hy);
    hy += lh;
  }

  // Blurb — the one-line read, under the headline.
  ctx.font = "400 42px Georgia, \"Times New Roman\", serif";
  ctx.fillStyle = inkSoft;
  let by = hy + 12;
  for (const line of blurbLines) {
    ctx.fillText(line, margin, by);
    by += 56;
  }
  signatureBar(
    ctx,
    margin,
    barY,
    maxW,
    30,
    spec.slices.map((s) => ({ pct: s.pct, color: s.color })),
    t.track,
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

  // App chrome — the user's theme, the golden emblem, garden-glow depth.
  const t = readTheme();
  const emblem = await loadEmblem();
  paintBackground(ctx, t);
  const brandBottom = paintBrand(ctx, t, emblem);

  const margin = 96;
  const ink = t.ink;
  const inkSoft = t.inkSoft;
  const maxW = W - margin * 2;

  // Eyebrow.
  let y = brandBottom + 110;
  ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = t.accent;
  ctx.fillText("MY JUDGEMENT, LOOKING BACK", margin, y);

  // The big number — the hero, in gold with a soft glow for depth.
  y += 250;
  glow(ctx, margin + 160, y - 76, 320, t.goldGlow);
  ctx.save();
  if (!t.light) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
  }
  ctx.font = "700 220px Georgia, \"Times New Roman\", serif";
  ctx.fillStyle = t.gold;
  ctx.fillText(spec.bigNumber, margin, y);
  ctx.restore();

  // Bottom zone limit — content must stop above the outcome bar (or the footer
  // when there's no bar), so nothing ever overlaps them.
  const footerY = H - margin;
  const hasSegs = !!(spec.segs && spec.segs.length);
  const barTop = footerY - 130 - 84;
  const contentLimit = (hasSegs ? barTop : footerY) - 44;

  // Label under the number — a generous gap clears the 220px glyph's baseline.
  // Clamped to 2 lines so it can't crowd out the insight.
  y += 88;
  ctx.font = "500 48px Georgia, \"Times New Roman\", serif";
  ctx.fillStyle = ink;
  for (const line of clampLines(ctx, wrap(ctx, spec.label, maxW), 2, maxW)) {
    ctx.fillText(line, margin, y);
    y += 62;
  }

  // Insight read — clamped (ellipsized) to whatever space is left above the bar.
  if (spec.insight) {
    y += 20;
    ctx.font = "400 38px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = inkSoft;
    const maxLines = Math.floor((contentLimit - y) / 52);
    if (maxLines >= 1) {
      for (const line of clampLines(ctx, wrap(ctx, spec.insight, maxW), maxLines, maxW)) {
        ctx.fillText(line, margin, y);
        y += 52;
      }
    }
  }
  if (spec.segs && spec.segs.length) {
    const legendY = footerY - 130;
    const barY = legendY - 84;
    signatureBar(ctx, margin, barY, maxW, 30, spec.segs, t.track);
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

// ── The "How I Show Up" card ────────────────────────────────────────────────
// Claude's honest mirror of what a person brings to a room — the bulleted
// reflection from their profile, turned into a warm identity card. The POINTS
// are the hero (they're the true story about this person); brand rides quietly.
// A companion to the Fingerprint card: fingerprint = how they think, this = how
// they show up.

export type ReflectionCardSpec = {
  heading: string; // "How Siva shows up" — the frame
  points: string[]; // the mirror, one trait per line — the hero content
  footer?: string;
};

export async function renderReflectionCard(spec: ReflectionCardSpec): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // App chrome — the user's theme, the golden emblem, garden-glow depth.
  const t = readTheme();
  const emblem = await loadEmblem();
  paintBackground(ctx, t);
  const brandBottom = paintBrand(ctx, t, emblem);

  const margin = 96;
  const ink = t.ink;
  const inkSoft = t.inkSoft;
  const accent = t.accent;
  const maxW = W - margin * 2;

  // Eyebrow + heading.
  let top = brandBottom + 96;
  ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText("🪞 HOW I SHOW UP", margin, top);
  top += 78;
  ctx.font = "700 60px Georgia, \"Times New Roman\", serif";
  ctx.fillStyle = ink;
  for (const line of wrap(ctx, spec.heading, maxW).slice(0, 2)) {
    ctx.fillText(line, margin, top);
    top += 74;
  }

  // Points — the hero content. Fit to the band: shrink the font, and if long
  // points still overflow at the floor, drop trailing traits so nothing ever
  // crosses into the footer (better a few complete traits than an overlap).
  const allPoints = spec.points.map((p) => p.trim()).filter(Boolean).slice(0, 5);
  const footerY = H - margin;
  const bandTop = top + 36;
  const bandH = footerY - 76 - bandTop; // clear gap kept above the footer
  const textX = margin + 46;
  const textW = maxW - 46;

  type Layout = { size: number; lineH: number; gap: number; sets: string[][]; total: number };
  const fit = (pts: string[]): Layout | null => {
    for (let s = 50; s >= 26; s -= 2) {
      ctx.font = `500 ${s}px Georgia, "Times New Roman", serif`;
      const lineH = Math.round(s * 1.3);
      const gap = Math.round(s * 0.7);
      const sets = pts.map((p) => wrap(ctx, p, textW));
      const total = sets.reduce((n, ls) => n + ls.length * lineH, 0) + gap * Math.max(0, pts.length - 1);
      if (total <= bandH) return { size: s, lineH, gap, sets, total };
    }
    return null;
  };

  let pts = allPoints;
  let layout = fit(pts);
  while (!layout && pts.length > 1) {
    pts = pts.slice(0, pts.length - 1); // drop the last trait and retry
    layout = fit(pts);
  }
  if (!layout) {
    // A single trait too long even at the floor — render it truncated to fit.
    const s = 26;
    ctx.font = `500 ${s}px Georgia, "Times New Roman", serif`;
    const lineH = Math.round(s * 1.3);
    const maxLines = Math.max(1, Math.floor(bandH / lineH));
    const lines = wrap(ctx, truncateCard(pts[0] ?? "", 240), textW).slice(0, maxLines);
    layout = { size: s, lineH, gap: 0, sets: [lines], total: lines.length * lineH };
  }

  const { size, lineH, gap, sets } = layout;
  let y = bandTop + Math.max(0, (bandH - layout.total) / 2) + size;
  ctx.font = `500 ${size}px Georgia, "Times New Roman", serif`;
  for (const ls of sets) {
    // Accent dot aligned to the first line's cap height.
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(margin + 12, y - size * 0.32, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    for (const line of ls) {
      ctx.fillText(line, textX, y);
      y += lineH;
    }
    y += gap;
  }

  // Footer.
  ctx.font = "500 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = inkSoft;
  ctx.fillText(spec.footer ?? "thinkthru.app — where thinking leaves a trace", margin, footerY);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to render"))), "image/png");
  });
}

export async function shareReflectionCard(
  spec: ReflectionCardSpec,
  opts?: { fileName?: string; shareText?: string },
): Promise<"shared" | "downloaded"> {
  const blob = await renderReflectionCard(spec);
  return shareBlob(blob, opts?.fileName ?? "thinkthru-how-i-show-up.png", opts?.shareText);
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
