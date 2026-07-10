import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { db } from "@/lib/db";
import { NavBar } from "@/components/NavBar";
import { AdminPanel } from "@/components/AdminPanel";
import { BackfillTopicsButton } from "@/components/BackfillTopicsButton";
import { GoodMorningButton } from "@/components/GoodMorningButton";
import { RekindleButton } from "@/components/RekindleButton";
import { countOpenReports } from "@/lib/services/reports";
import { countOpenFeedback } from "@/lib/services/feedback";

// AI-tag usage meter (best-effort — the table may not be migrated yet).
async function aiTagStats() {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [total, thisMonth, claude, chatgpt, taggers] = await Promise.all([
      db.aiTagEvent.count(),
      db.aiTagEvent.count({ where: { createdAt: { gte: monthStart } } }),
      db.aiTagEvent.count({ where: { provider: "claude" } }),
      db.aiTagEvent.count({ where: { provider: "chatgpt" } }),
      db.aiTagEvent.findMany({ distinct: ["userId"], select: { userId: true } }),
    ]);
    return { total, thisMonth, claude, chatgpt, people: taggers.length, ok: true as const };
  } catch {
    return { total: 0, thisMonth: 0, claude: 0, chatgpt: 0, people: 0, ok: false as const };
  }
}

// Every member with their footprint — seeds planted, messages, AI calls. Sorted
// by who's most active. Best-effort so a missing table never breaks the page.
async function adminMembers() {
  try {
    const [users, seeds, msgs, ai] = await Promise.all([
      db.user.findMany({
        where: { deletedAt: null, name: { notIn: ["Claude", "ChatGPT"] } },
        select: { id: true, name: true, email: true },
        take: 2000,
      }),
      db.seed.groupBy({ by: ["createdById"], where: { deletedAt: null }, _count: { _all: true } }),
      db.contribution.groupBy({ by: ["authorId"], where: { deletedAt: null }, _count: { _all: true } }),
      db.aiTagEvent.groupBy({ by: ["userId"], _count: { _all: true } }).catch(() => []),
    ]);
    const seedBy = new Map(
      (seeds as { createdById: string; _count: { _all: number } }[]).map((s) => [s.createdById, s._count._all]),
    );
    const msgBy = new Map(
      (msgs as { authorId: string; _count: { _all: number } }[]).map((m) => [m.authorId, m._count._all]),
    );
    const aiBy = new Map(
      (ai as { userId: string; _count: { _all: number } }[]).map((a) => [a.userId, a._count._all]),
    );
    const rows = (users as { id: string; name: string | null; email: string | null }[])
      .map((u) => ({
        id: u.id,
        name: u.name || u.email || "Someone",
        email: u.email || "",
        seeds: seedBy.get(u.id) ?? 0,
        messages: msgBy.get(u.id) ?? 0,
        ai: aiBy.get(u.id) ?? 0,
      }))
      .sort((a, b) => b.messages - a.messages || b.seeds - a.seeds || a.name.localeCompare(b.name));
    return { rows, total: rows.length, ok: true as const };
  } catch {
    return { rows: [] as { id: string; name: string; email: string; seeds: number; messages: number; ai: number }[], total: 0, ok: false as const };
  }
}

// Cron heartbeats — when each scheduled slot last actually fired. This is the
// fastest way to tell "the cron isn't running" from "it ran but had nothing to
// send", without digging through Vercel logs.
async function cronHeartbeats() {
  try {
    const rows = await db.cronRun.findMany({ orderBy: { lastRunAt: "desc" } });
    return {
      ok: true as const,
      rows: rows as { name: string; lastRunAt: Date; detail: string | null }[],
      hasSecret: !!process.env.CRON_SECRET,
    };
  } catch {
    return { ok: false as const, rows: [], hasSecret: !!process.env.CRON_SECRET };
  }
}

function ago(d: Date): string {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const dynamic = "force-dynamic";

// Owner-only admin page. Gated to ADMIN_EMAILS — anyone else gets a 404 (so its
// existence isn't even revealed). Lets the owner apply DB migrations from a
// phone, no laptop required.
export default async function AdminPage() {
  const viewer = await requireViewer();
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0 || !allow.includes((viewer.email ?? "").toLowerCase())) {
    notFound();
  }

  const ai = await aiTagStats();
  const members = await adminMembers();
  const openReports = await countOpenReports().catch(() => 0);
  const openFeedback = await countOpenFeedback().catch(() => 0);
  const crons = await cronHeartbeats();

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-lg px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Your gardens
        </Link>
        <h1 className="serif-xl mb-6">🛠 Admin</h1>

        {/* AI-tag usage meter */}
        <div className="card mb-4 p-4">
          <p className="eyebrow mb-3">🤖 AI tags</p>
          {ai.ok ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-center">
                <Stat n={ai.thisMonth} label="this month" />
                <Stat n={ai.total} label="all time" />
                <Stat n={ai.claude} label="Claude" />
                <Stat n={ai.chatgpt} label="ChatGPT" />
              </div>
              <p className="mt-3 text-center text-xs text-ink-soft">{ai.people} people have tagged AI</p>
            </>
          ) : (
            <p className="text-xs text-ink-soft">
              No data yet — apply the latest migration below to start metering AI tags.
            </p>
          )}
        </div>

        {/* Cron heartbeats — did the scheduler actually fire? */}
        <div className="card mb-4 p-4">
          <p className="eyebrow mb-3">⏰ Scheduled jobs</p>
          {crons.rows.length > 0 ? (
            <div className="space-y-1.5">
              {crons.rows.map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink capitalize">{c.name}</span>
                  <span className="flex items-center gap-2 text-xs text-ink-soft">
                    {c.detail && <span>{c.detail}</span>}
                    <span className="text-ink-mid">{ago(c.lastRunAt)}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-soft">
              No cron has run since this was added. If tomorrow&apos;s 10:00 AM still shows nothing
              here, the scheduler isn&apos;t reaching the app.
            </p>
          )}
          <p className="mt-3 text-[11px] text-ink-soft">
            CRON_SECRET is {crons.hasSecret ? "set ✓" : "not set — the job now runs anyway, but set it in Vercel to lock it down"}.
          </p>
        </div>

        {/* Members — everyone on ThinkThru with their footprint */}
        <div className="card mb-4 p-4">
          <p className="eyebrow mb-3">👥 Members{members.ok ? ` · ${members.total}` : ""}</p>
          {members.ok && members.rows.length > 0 ? (
            <>
              <div className="mb-1.5 flex items-center justify-end gap-3 text-[10px] uppercase tracking-wide text-ink-soft">
                <span className="w-8 text-right">🌱</span>
                <span className="w-8 text-right">💬</span>
                <span className="w-8 text-right">🤖</span>
              </div>
              <div className="space-y-1.5">
                {members.rows.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.05)] pb-1.5 last:border-0"
                  >
                    <Link href={`/u/${m.id}`} className="min-w-0 transition hover:text-accent">
                      <span className="block truncate text-sm text-ink">{m.name}</span>
                      {m.email && <span className="block truncate text-[11px] text-ink-soft">{m.email}</span>}
                    </Link>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-ink-mid">
                      <span className="w-8 text-right">{m.seeds}</span>
                      <span className="w-8 text-right">{m.messages}</span>
                      <span className="w-8 text-right">{m.ai}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-soft">🌱 seeds · 💬 messages · 🤖 AI calls · tap a name for their profile</p>
            </>
          ) : (
            <p className="text-xs text-ink-soft">No members yet.</p>
          )}
        </div>

        <AdminPanel />
        <GoodMorningButton />
        <RekindleButton />
        <BackfillTopicsButton />
        <Link
          href="/admin/feedback"
          className="card mt-4 flex items-center justify-between p-4 transition hover:border-accent"
        >
          <span>
            <span className="block text-sm text-ink">🐞 Feedback</span>
            <span className="block text-xs text-ink-soft">Bug reports and ideas from inside the app</span>
          </span>
          <span className="flex items-center gap-2">
            {openFeedback > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-bg">
                {openFeedback} open
              </span>
            )}
            <span className="text-ink-soft">→</span>
          </span>
        </Link>
        <Link
          href="/admin/reports"
          className="card mt-4 flex items-center justify-between p-4 transition hover:border-accent"
        >
          <span>
            <span className="block text-sm text-ink">🚩 Reports</span>
            <span className="block text-xs text-ink-soft">Review flagged content and moderate</span>
          </span>
          <span className="flex items-center gap-2">
            {openReports > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-bg">
                {openReports} open
              </span>
            )}
            <span className="text-ink-soft">→</span>
          </span>
        </Link>
        <Link
          href="/admin/messages"
          className="card mt-4 flex items-center justify-between p-4 transition hover:border-accent"
        >
          <span>
            <span className="block text-sm text-ink">🌅 Daily messages</span>
            <span className="block text-xs text-ink-soft">Curate the morning good-morning library</span>
          </span>
          <span className="text-ink-soft">→</span>
        </Link>
      </main>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-xl border border-[rgba(76,175,80,0.15)] py-2">
      <div className="serif-lg text-ink">{n}</div>
      <div className="text-[11px] text-ink-soft">{label}</div>
    </div>
  );
}
