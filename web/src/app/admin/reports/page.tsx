import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { isAppOwner } from "@/lib/admin";
import { NavBar } from "@/components/NavBar";
import { listReports } from "@/lib/services/reports";
import { ReportsQueue } from "@/components/ReportsQueue";

export const dynamic = "force-dynamic";

// App-owner moderation queue. Reactive-only: it shows exactly what people
// reported — nothing else — so private content is never browsed, only reviewed
// when flagged.
export default async function ReportsPage() {
  const viewer = await requireViewer();
  if (!isAppOwner(viewer.email)) notFound();

  let reports: Awaited<ReturnType<typeof listReports>> = [];
  try {
    reports = await listReports("open");
  } catch {
    reports = [];
  }

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/admin" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Admin
        </Link>
        <h1 className="serif-xl mb-2">🚩 Reports</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Content people flagged for review. Removing is immediate and soft-deletes the message or
          seed; dismissing closes the report with no action.
        </p>
        <ReportsQueue initial={reports} />
      </main>
    </div>
  );
}
