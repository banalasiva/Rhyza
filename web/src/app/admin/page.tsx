import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { db } from "@/lib/db";
import { NavBar } from "@/components/NavBar";
import { AdminPanel } from "@/components/AdminPanel";
import { countOpenReports } from "@/lib/services/reports";

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
  const openReports = await countOpenReports().catch(() => 0);

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

        <AdminPanel />
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
