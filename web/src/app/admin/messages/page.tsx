import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { NavBar } from "@/components/NavBar";
import { DailyMessagesAdmin } from "@/components/DailyMessagesAdmin";

export const dynamic = "force-dynamic";

// Owner-only editor for the daily "good morning" message library.
export default async function AdminMessagesPage() {
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
        <Link href="/admin" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Admin
        </Link>
        <h1 className="serif-xl mb-1">🌅 Daily messages</h1>
        <p className="mb-6 text-sm text-ink-soft">
          What ThinkThru says each morning. A calm library to curate — add your own voice, retire what
          doesn’t fit. One shared message goes to everyone each day.
        </p>
        <DailyMessagesAdmin />
      </main>
    </div>
  );
}
