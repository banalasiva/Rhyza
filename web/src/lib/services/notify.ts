// Central delivery layer for notifications. The in-app rows are still created by
// each feature (bloom, mention, endorsement, …); this module takes those rows
// and fans them out to the external channels — instant email for the big
// moments, web push for everything — respecting each person's preferences.
//
// Cadence: PUSH is instant for every notification (it's lightweight and that's
// the point of a phone alert). EMAIL is instant only for "big moments"; quieter
// activity rolls into the daily digest (see /api/cron/digest), which is why we
// stamp emailedAt here so the digest never repeats what already went out.

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import {
  appUrl,
  emailConfigured,
  sendEmail,
  mentionEmailHtml,
  bloomEmailHtml,
  endorsementEmailHtml,
} from "@/lib/email";
import { aiConfigured, openaiConfigured, composeImpactCopy } from "@/lib/ai";
import { pushConfigured, sendPushToUser } from "@/lib/push";

// Which notification types earn an instant email. Everything else is push-now,
// email-in-the-digest.
const BIG_MOMENTS = new Set(["mention", "bloom", "endorsement"]);

type EmailKind = "mention" | "bloom" | "endorsement";

export type DeliverItem = {
  notificationId: string; // so we can stamp emailedAt / pushedAt
  recipientId: string;
  type: string;
  push: { title: string; body: string }; // what the phone alert says
  link: string; // relative path, e.g. /seeds/<id>
  email?: {
    kind: EmailKind;
    seedTitle: string;
    actorName?: string;
    snippet?: string;
  };
};

// Pick whichever AI is configured to warm up impact copy (Claude first).
function impactProvider(): "claude" | "chatgpt" | null {
  if (aiConfigured()) return "claude";
  if (openaiConfigured()) return "chatgpt";
  return null;
}

async function ensureUnsubToken(userId: string, current: string | null): Promise<string> {
  if (current) return current;
  const token = randomUUID();
  await db.user.update({ where: { id: userId }, data: { unsubToken: token } }).catch(() => {});
  return token;
}

// Fan a batch of just-created notifications out to email + push. Best-effort:
// never throws, so a delivery hiccup can't break the action that triggered it.
export async function deliver(items: DeliverItem[]): Promise<void> {
  if (items.length === 0) return;
  try {
    const recipientIds = [...new Set(items.map((i) => i.recipientId))];
    const users = await db.user.findMany({
      where: { id: { in: recipientIds } },
      select: {
        id: true,
        email: true,
        name: true,
        emailNotify: true,
        pushNotify: true,
        unsubToken: true,
      },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const base = appUrl();
    const provider = impactProvider();

    await Promise.all(
      items.map(async (item) => {
        const u = byId.get(item.recipientId);
        if (!u) return;
        const url = `${base}${item.link}`;

        // ── Web push (instant, every type) ──
        if (u.pushNotify && pushConfigured()) {
          const n = await sendPushToUser(item.recipientId, {
            title: item.push.title,
            body: item.push.body,
            url,
            tag: item.type,
          });
          if (n > 0) {
            await db.notification
              .update({ where: { id: item.notificationId }, data: { pushedAt: new Date() } })
              .catch(() => {});
          }
        }

        // ── Email (instant only for big moments) ──
        const wantsEmail =
          item.email && BIG_MOMENTS.has(item.type) && u.emailNotify && emailConfigured() && u.email;
        if (wantsEmail && item.email) {
          const token = await ensureUnsubToken(u.id, u.unsubToken);
          const unsubLink = `${base}/unsubscribe?token=${token}`;
          const html = await renderEmail(item.email, {
            recipientName: u.name,
            link: url,
            unsubLink,
            provider,
          });
          if (html) {
            const ok = await sendEmail({ to: u.email, subject: html.subject, html: html.body });
            if (ok) {
              await db.notification
                .update({ where: { id: item.notificationId }, data: { emailedAt: new Date() } })
                .catch(() => {});
            }
          }
        }
      }),
    );
  } catch (err) {
    console.error("[notify] deliver failed", err);
  }
}

async function renderEmail(
  email: NonNullable<DeliverItem["email"]>,
  ctx: {
    recipientName: string;
    link: string;
    unsubLink: string;
    provider: "claude" | "chatgpt" | null;
  },
): Promise<{ subject: string; body: string } | null> {
  if (email.kind === "mention") {
    return {
      subject: `${email.actorName || "Someone"} mentioned you on Rhyza`,
      body: mentionEmailHtml({
        actorName: email.actorName || "Someone",
        recipientName: ctx.recipientName,
        seedTitle: email.seedTitle,
        link: ctx.link,
        unsubLink: ctx.unsubLink,
      }),
    };
  }

  if (email.kind === "bloom") {
    const ai = ctx.provider
      ? await composeImpactCopy(ctx.provider, {
          kind: "bloom",
          recipientName: ctx.recipientName,
          seedTitle: email.seedTitle,
        })
      : null;
    return {
      subject: ai?.heading || `${email.seedTitle} just bloomed 🌸`,
      body: bloomEmailHtml({
        recipientName: ctx.recipientName,
        seedTitle: email.seedTitle,
        link: ctx.link,
        heading: ai?.heading,
        intro: ai?.intro,
        unsubLink: ctx.unsubLink,
      }),
    };
  }

  // endorsement
  const ai = ctx.provider
    ? await composeImpactCopy(ctx.provider, {
        kind: "endorsement",
        recipientName: ctx.recipientName,
        seedTitle: email.seedTitle,
        actorName: email.actorName,
        snippet: email.snippet,
      })
    : null;
  return {
    subject: ai?.heading || `${email.actorName || "Someone"} found your point valuable ✦`,
    body: endorsementEmailHtml({
      recipientName: ctx.recipientName,
      actorName: email.actorName || "Someone",
      snippet: email.snippet || "",
      seedTitle: email.seedTitle,
      link: ctx.link,
      heading: ai?.heading,
      intro: ai?.intro,
      unsubLink: ctx.unsubLink,
    }),
  };
}
