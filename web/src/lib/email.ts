// Transactional email via Resend's HTTP API (no SDK dependency — just fetch).
// If RESEND_API_KEY isn't set, sending is skipped gracefully so invite *links*
// still work without an email provider configured.

export function appUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

type SendArgs = { to: string; subject: string; html: string };

export async function sendEmail({ to, subject, html }: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false; // not configured — caller falls back to the link
  const from = process.env.RESEND_FROM || "Rhyza <onboarding@resend.dev>";
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

export function inviteEmailHtml(args: {
  orgName: string;
  gardenName?: string | null;
  inviterName: string;
  link: string;
}): string {
  const where = args.gardenName
    ? `the <strong>${escapeHtml(args.gardenName)}</strong> garden in <strong>${escapeHtml(args.orgName)}</strong>`
    : `<strong>${escapeHtml(args.orgName)}</strong>`;
  return `
  <div style="font-family:Inter,system-ui,sans-serif;background:#070D07;color:#E8E4DC;padding:32px;border-radius:16px;max-width:480px;margin:auto">
    <div style="font-size:28px">🌱</div>
    <h1 style="font-weight:300;font-size:22px;margin:8px 0">You've been invited to Rhyza</h1>
    <p style="color:#A0A890;line-height:1.6;font-size:15px">
      ${escapeHtml(args.inviterName)} invited you to join ${where} — a garden where ideas grow into collective knowledge.
    </p>
    <a href="${args.link}" style="display:inline-block;margin-top:16px;background:#4CAF50;color:#070D07;text-decoration:none;padding:12px 22px;border-radius:100px;font-weight:600">
      Accept invite
    </a>
    <p style="color:#5A6456;font-size:12px;margin-top:20px">
      Or paste this link into your browser:<br>${args.link}
    </p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
