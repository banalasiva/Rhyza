import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { appUrl, emailConfigured, sendEmail, digestEmailHtml } from "@/lib/email";
import { cronAuthorized, markCronRun } from "@/lib/cron";

export const dynamic = "force-dynamic";
// Give the (currently sequential) email loop room; default timeout kills it
// mid-send and those notifications fall outside the next run's 24h window and
// are lost. 60s is plan-safe; a queue is the real fix (see roadmap).
export const maxDuration = 60;

// Relative link for a notification's entity.
function linkFor(entityType: string | null, entityId: string | null): string {
  if (!entityId) return "/";
  switch (entityType) {
    case "bloom":
      return `/blooms/${entityId}`;
    case "garden":
      return `/gardens/${entityId}`;
    case "seed":
    default:
      return `/seeds/${entityId}`;
  }
}

// GET /api/cron/digest — one calm daily email per person, rolling up the quiet
// activity that didn't already earn an instant email. Triggered by Vercel Cron
// (see vercel.json); protected by CRON_SECRET so only the scheduler can run it.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!emailConfigured()) {
    await markCronRun("digest", "email not configured");
    return NextResponse.json({ ok: true, sent: 0, note: "email not configured" });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // Everything from the last day that hasn't already been emailed, for people
  // who still want the digest.
  const pending = await db.notification.findMany({
    where: {
      emailedAt: null,
      createdAt: { gte: cutoff },
      recipient: { digestNotify: true, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    take: 4000,
    select: {
      id: true,
      title: true,
      body: true,
      entityType: true,
      entityId: true,
      recipientId: true,
      recipient: { select: { id: true, email: true, name: true, unsubToken: true } },
    },
  });

  // Group by recipient.
  const groups = new Map<string, typeof pending>();
  for (const n of pending) {
    if (!n.recipient?.email) continue;
    const arr = groups.get(n.recipientId) ?? [];
    arr.push(n);
    groups.set(n.recipientId, arr);
  }

  const base = appUrl();
  let sent = 0;
  for (const [, items] of groups) {
    const recipient = items[0].recipient!;
    let token = recipient.unsubToken;
    if (!token) {
      token = randomUUID();
      await db.user.update({ where: { id: recipient.id }, data: { unsubToken: token } }).catch(() => {});
    }
    const top = items.slice(0, 12);
    const html = digestEmailHtml({
      recipientName: recipient.name,
      items: top.map((n) => ({
        title: n.title,
        body: n.body,
        link: `${base}${linkFor(n.entityType, n.entityId)}`,
      })),
      homeLink: base,
      unsubLink: `${base}/unsubscribe?token=${token}`,
    });
    const subject =
      items.length === 1
        ? items[0].title
        : `${items.length} new things in your gardens 🌿`;
    const ok = await sendEmail({ to: recipient.email!, subject, html });
    if (ok) {
      sent++;
      await db.notification.updateMany({
        where: { id: { in: items.map((n) => n.id) } },
        data: { emailedAt: new Date() },
      });
    }
  }

  await markCronRun("digest", `sent ${sent}/${groups.size}`);
  return NextResponse.json({ ok: true, recipients: groups.size, sent });
}
