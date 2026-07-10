import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { isAppOwner } from "@/lib/admin";
import { NavBar } from "@/components/NavBar";
import { listFeedback } from "@/lib/services/feedback";
import { FeedbackQueue } from "@/components/FeedbackQueue";

export const dynamic = "force-dynamic";

// Owner-only inbox for in-app bug reports and ideas. This is the triage queue:
// read what people hit, fix it, mark resolved.
export default async function FeedbackPage() {
  const viewer = await requireViewer();
  if (!isAppOwner(viewer.email)) notFound();

  let items: Awaited<ReturnType<typeof listFeedback>> = [];
  try {
    items = await listFeedback("open");
  } catch {
    items = [];
  }

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/admin" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Admin
        </Link>
        <h1 className="serif-xl mb-2">🐞 Feedback</h1>
        <p className="mb-6 text-sm text-ink-soft">
          What people reported from inside the app — the page and device are captured so each one is
          actionable. Fix it, then mark it resolved.
        </p>
        <FeedbackQueue initial={items} />
      </main>
    </div>
  );
}
