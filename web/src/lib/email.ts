// Transactional email via Resend's HTTP API (no SDK dependency — just fetch).
// If RESEND_API_KEY isn't set, sending is skipped gracefully so invite *links*
// still work without an email provider configured.

import { headers } from "next/headers";

// The app's public base URL, used to build invite links. Prefers an explicit
// APP_URL/AUTH_URL (canonical), otherwise auto-detects from the incoming
// request's host — so links point at whatever domain you're actually on
// (production, preview, or localhost) without any env var.
export function appUrl(): string {
  const fromEnv = process.env.APP_URL || process.env.AUTH_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // headers() is only available within a request — fall through otherwise.
  }
  return "http://localhost:3000";
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

type SendArgs = { to: string; subject: string; html: string };

export async function sendEmail({ to, subject, html }: SendArgs): Promise<boolean> {
  // Trim defensively — a stray newline/space pasted into the env var would
  // otherwise make the Authorization header invalid.
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false; // not configured — caller falls back to the link
  const from = (process.env.RESEND_FROM || "ThinkThru <onboarding@resend.dev>").trim();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    console.error("[email] Resend send failed", res.status, await res.text());
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────
// Shared email shell — one garden-themed layout every email pours into, so the
// brand stays consistent and changes happen in one place. Dark, warm, with a
// soft gradient header, a single clear call-to-action, and a footer that says
// why you're getting this and how to stop.
// ─────────────────────────────────────────────────────────────

type ShellArgs = {
  preview: string; // inbox preview line (hidden in the body)
  glyph?: string; // emoji crest, defaults to the seed
  heading: string;
  bodyHtml: string; // already-escaped inner HTML
  ctaText: string;
  ctaLink: string;
  reason?: string; // "You're getting this because…"
  unsubLink?: string; // one-click unsubscribe
};

export function emailShell(a: ShellArgs): string {
  const glyph = a.glyph ?? "🌱";
  // Escape href values defensively (HTML-attribute context).
  const cta = escapeHtml(a.ctaLink);
  const unsub = a.unsubLink ? escapeHtml(a.unsubLink) : "";
  const footer = `
    <p style="color:#5A6456;font-size:12px;line-height:1.6;margin:24px 0 0">
      ${escapeHtml(a.reason ?? "You're getting this because you're part of a ThinkThru garden.")}
      ${
        unsub
          ? `<br><a href="${unsub}" style="color:#5A6456;text-decoration:underline">Turn off emails like this</a>`
          : ""
      }
    </p>`;
  return `
  <div style="margin:0;padding:0;background:#04080455">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(a.preview)}</div>
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:#050A05;padding:28px 16px">
    <div style="max-width:480px;margin:0 auto;background:#0B120B;border:1px solid rgba(76,175,80,0.18);border-radius:20px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#11331A 0%,#0B120B 70%);padding:28px 28px 18px">
        <div style="font-size:30px;line-height:1">${glyph}</div>
        <h1 style="color:#E8E4DC;font-weight:300;font-size:21px;line-height:1.3;margin:12px 0 0">${escapeHtml(
          a.heading,
        )}</h1>
      </div>
      <div style="padding:8px 28px 28px">
        <div style="color:#A0A890;line-height:1.65;font-size:15px">${a.bodyHtml}</div>
        <a href="${cta}" style="display:inline-block;margin-top:20px;background:#4CAF50;color:#06120A;text-decoration:none;padding:12px 24px;border-radius:100px;font-weight:600;font-size:15px">
          ${escapeHtml(a.ctaText)}
        </a>
        <p style="color:#5A6456;font-size:12px;margin-top:18px;word-break:break-all">
          Or open this link:<br><a href="${cta}" style="color:#7BA37F">${cta}</a>
        </p>
        ${footer}
      </div>
    </div>
    <p style="text-align:center;color:#3A463A;font-size:11px;margin:16px 0 0">ThinkThru · grow ideas into knowledge</p>
  </div>
  </div>`;
}

export function inviteEmailHtml(args: {
  orgName: string;
  gardenName?: string | null;
  inviterName: string;
  link: string;
}): string {
  const where = args.gardenName
    ? `the <strong style="color:#E8E4DC">${escapeHtml(args.gardenName)}</strong> garden in <strong style="color:#E8E4DC">${escapeHtml(args.orgName)}</strong>`
    : `<strong style="color:#E8E4DC">${escapeHtml(args.orgName)}</strong>`;
  return emailShell({
    preview: `${args.inviterName} invited you to ThinkThru`,
    heading: "You've been invited to ThinkThru",
    bodyHtml: `${escapeHtml(args.inviterName)} invited you to join ${where} — a garden where ideas grow into collective knowledge.`,
    ctaText: "Accept invite",
    ctaLink: args.link,
    reason: "You're getting this because someone invited you to a ThinkThru garden.",
  });
}

export function mentionEmailHtml(args: {
  actorName: string;
  recipientName: string;
  seedTitle: string;
  link: string;
  snippet?: string;
  unsubLink?: string;
}): string {
  const quoted = args.snippet
    ? `<blockquote style="border-left:3px solid #4CAF50;margin:14px 0 0;padding:2px 0 2px 14px;color:#C7CDBC;font-style:italic">“${escapeHtml(
        args.snippet,
      )}”</blockquote>`
    : "";
  return emailShell({
    preview: args.snippet
      ? `${args.actorName}: ${args.snippet}`
      : `${args.actorName} mentioned you in ${args.seedTitle}`,
    glyph: "💬",
    heading: `${args.actorName} mentioned you`,
    bodyHtml: `Hi ${escapeHtml(args.recipientName || "there")} — ${escapeHtml(
      args.actorName,
    )} tagged you in <strong style="color:#E8E4DC">${escapeHtml(args.seedTitle)}</strong>. Your voice is wanted in this conversation.${quoted}`,
    ctaText: "View the conversation",
    ctaLink: args.link,
    reason: "You're getting this because you were mentioned on ThinkThru.",
    unsubLink: args.unsubLink,
  });
}

// Impact moment — your contribution helped a seed bloom into durable knowledge.
export function bloomEmailHtml(args: {
  recipientName: string;
  seedTitle: string;
  link: string;
  heading?: string; // AI-personalised when available
  intro?: string; // AI-personalised when available
  unsubLink?: string;
}): string {
  return emailShell({
    preview: args.intro || `${args.seedTitle} just bloomed`,
    glyph: "🌸",
    heading: args.heading || "Your thinking helped a seed bloom",
    bodyHtml: `${
      args.intro
        ? escapeHtml(args.intro)
        : `Hi ${escapeHtml(args.recipientName || "there")} — <strong style="color:#E8E4DC">${escapeHtml(
            args.seedTitle,
          )}</strong> just bloomed. The understanding you helped grow is now permanent knowledge in the Sacred Tree.`
    }`,
    ctaText: "See the bloom",
    ctaLink: args.link,
    reason: "You're getting this because you contributed to a seed that bloomed.",
    unsubLink: args.unsubLink,
  });
}

// Impact moment — someone found your point valuable (an endorsement).
export function endorsementEmailHtml(args: {
  recipientName: string;
  actorName: string;
  snippet: string;
  seedTitle: string;
  link: string;
  heading?: string;
  intro?: string;
  unsubLink?: string;
}): string {
  const quoted = args.snippet
    ? `<blockquote style="border-left:3px solid #4CAF50;margin:14px 0 0;padding:2px 0 2px 14px;color:#C7CDBC;font-style:italic">“${escapeHtml(
        args.snippet,
      )}”</blockquote>`
    : "";
  return emailShell({
    preview: `${args.actorName} found your point valuable`,
    glyph: "✦",
    heading: args.heading || `${args.actorName} found your point valuable`,
    bodyHtml: `${
      args.intro
        ? escapeHtml(args.intro)
        : `Hi ${escapeHtml(args.recipientName || "there")} — ${escapeHtml(
            args.actorName,
          )} marked your contribution in <strong style="color:#E8E4DC">${escapeHtml(
            args.seedTitle,
          )}</strong> as valuable. You were understood.`
    }${quoted}`,
    ctaText: "Revisit the moment",
    ctaLink: args.link,
    reason: "You're getting this because your contribution was endorsed.",
    unsubLink: args.unsubLink,
  });
}

// A calm daily roundup of everything that happened while you were away.
export function digestEmailHtml(args: {
  recipientName: string;
  items: { title: string; body?: string | null; link: string }[];
  homeLink: string;
  intro?: string;
  unsubLink?: string;
}): string {
  const rows = args.items
    .map(
      (it) => `
      <a href="${escapeHtml(it.link)}" style="display:block;text-decoration:none;border:1px solid rgba(76,175,80,0.14);border-radius:12px;padding:13px 15px;margin-top:10px;background:#0E160E">
        <div style="color:#E8E4DC;font-size:14px;font-weight:600">${escapeHtml(it.title)}</div>
        ${it.body ? `<div style="color:#8A937E;font-size:13px;margin-top:3px">${escapeHtml(it.body)}</div>` : ""}
      </a>`,
    )
    .join("");
  return emailShell({
    preview: `${args.items.length} new thing${args.items.length === 1 ? "" : "s"} in your gardens`,
    glyph: "🌿",
    heading: args.intro ? args.intro : "While you were away",
    bodyHtml: `Hi ${escapeHtml(args.recipientName || "there")} — here's what grew in your gardens:${rows}`,
    ctaText: "Open ThinkThru",
    ctaLink: args.homeLink,
    reason: "You're getting this daily digest because you have activity in your gardens.",
    unsubLink: args.unsubLink,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
