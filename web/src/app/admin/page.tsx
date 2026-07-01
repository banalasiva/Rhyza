import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { NavBar } from "@/components/NavBar";
import { AdminPanel } from "@/components/AdminPanel";

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

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-lg px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Your gardens
        </Link>
        <h1 className="serif-xl mb-6">🛠 Admin</h1>
        <AdminPanel />
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
