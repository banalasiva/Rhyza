import { db } from "@/lib/db";
import { deliver } from "@/lib/services/notify";
import { createFeedbackIssue } from "@/lib/github-issues";

// In-app feedback — the fast lane from "I hit a bug" to a fix. A person reports
// from anywhere; we capture the page + device so it's actionable, then ping the
// owner so nothing sits unseen. The owner triages in /admin and ships.

export type FeedbackKind = "bug" | "idea" | "other";
const KINDS: FeedbackKind[] = ["bug", "idea", "other"];

// The owner accounts to notify — same ADMIN_EMAILS gate used elsewhere.
async function adminUserIds(): Promise<string[]> {
  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return [];
  const users = await db.user
    .findMany({ where: { email: { in: emails }, deletedAt: null }, select: { id: true } })
    .catch(() => [] as { id: string }[]);
  return (users as { id: string }[]).map((u) => u.id);
}

export async function submitFeedback(
  userId: string,
  input: { kind?: string; message: string; path?: string; userAgent?: string },
): Promise<{ ok: true }> {
  const kind = (KINDS as string[]).includes(input.kind ?? "") ? (input.kind as FeedbackKind) : "bug";
  const message = input.message.trim().slice(0, 4000);
  if (!message) return { ok: true };

  const reporter = await db.user
    .findUnique({ where: { id: userId }, select: { name: true } })
    .catch(() => null);

  const created = (await db.feedback.create({
    data: {
      userId,
      kind,
      message,
      path: input.path?.slice(0, 400) ?? null,
      userAgent: input.userAgent?.slice(0, 400) ?? null,
    },
    select: { id: true },
  })) as { id: string };

  // Auto-file a GitHub issue (opt-in via env) so the report lands where fixes
  // happen. Best-effort — never blocks the feedback. Stash the URL for triage.
  try {
    const url = await createFeedbackIssue({
      kind,
      message,
      reporter: reporter?.name ?? null,
      path: input.path ?? null,
      userAgent: input.userAgent ?? null,
    });
    if (url) {
      await db.feedback.update({ where: { id: created.id }, data: { githubUrl: url } }).catch(() => {});
    }
  } catch (err) {
    console.error("submitFeedback: github issue failed", err);
  }

  // Ping the owner(s) so feedback never sits unseen. Best-effort.
  try {
    const admins = (await adminUserIds()).filter((id) => id !== userId);
    if (admins.length) {
      const who = reporter?.name?.trim() || "Someone";
      const icon = kind === "idea" ? "💡" : kind === "other" ? "💬" : "🐞";
      const title = `${icon} ${kind === "idea" ? "New idea" : kind === "other" ? "New feedback" : "New bug report"}`;
      const body = `${who}: ${message.slice(0, 120)}`;
      const notes = await Promise.all(
        admins.map((rid) =>
          db.notification
            .create({
              data: { recipientId: rid, actorId: userId, type: "feedback", title, body, entityType: "feedback" },
              select: { id: true, recipientId: true },
            })
            .catch(() => null),
        ),
      );
      await deliver(
        notes
          .filter((n): n is { id: string; recipientId: string } => !!n)
          .map((n) => ({
            notificationId: n.id,
            recipientId: n.recipientId,
            type: "feedback",
            push: { title, body },
            link: `/admin/feedback`,
          })),
      );
    }
  } catch (err) {
    console.error("submitFeedback: notify failed", err);
  }

  return { ok: true };
}

export type FeedbackRow = {
  id: string;
  kind: string;
  message: string;
  path: string | null;
  userAgent: string | null;
  status: string;
  githubUrl: string | null;
  createdAt: Date;
  reporter: string | null;
};

export async function listFeedback(status: "open" | "resolved" | "all" = "open"): Promise<FeedbackRow[]> {
  const rows = (await db.feedback
    .findMany({
      where: status === "all" ? {} : { status },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    .catch(() => [])) as {
    id: string;
    userId: string | null;
    kind: string;
    message: string;
    path: string | null;
    userAgent: string | null;
    status: string;
    githubUrl: string | null;
    createdAt: Date;
  }[];
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
  const users = userIds.length
    ? ((await db.user
        .findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
        .catch(() => [])) as { id: string; name: string | null; email: string | null }[])
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name || u.email]));

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    message: r.message,
    path: r.path,
    userAgent: r.userAgent,
    status: r.status,
    githubUrl: r.githubUrl,
    createdAt: r.createdAt,
    reporter: r.userId ? nameById.get(r.userId) ?? null : null,
  }));
}

export async function setFeedbackStatus(id: string, status: "open" | "resolved"): Promise<{ ok: true }> {
  await db.feedback.update({ where: { id }, data: { status } }).catch(() => {});
  return { ok: true };
}

export async function countOpenFeedback(): Promise<number> {
  return db.feedback.count({ where: { status: "open" } }).catch(() => 0);
}
