import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { listKept } from "@/lib/services/kept";
import { NavBar } from "@/components/NavBar";

// "Kept" — the messages you saved for yourself. A private list you can always
// return to, deep-linking straight back to the message in its seed (even after
// the seed has bloomed). Best-effort: an empty/unavailable table just shows the
// empty state.
export default async function KeptPage() {
  const viewer = await requireViewer();
  const items = await listKept(viewer.userId);

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Your gardens
        </Link>

        <div className="mb-6">
          <p className="eyebrow mb-1">🔖 Kept</p>
          <h1 className="serif-lg">Messages you saved</h1>
          <p className="mt-1 text-sm text-ink-mid">
            The thoughts you wanted to hold onto — tap any to land back on it in its seed.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-mid">
            <div className="mb-2 text-3xl">🔖</div>
            Nothing kept yet. In any conversation, open a message&apos;s ⋯ and tap{" "}
            <span className="text-accent">Keep</span> to save it here — it stays even after the
            seed blooms.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.contributionId}>
                <Link
                  href={`/seeds/${it.seedId}#c-${it.contributionId}`}
                  className="card block p-4 transition hover:border-[rgba(76,175,80,0.4)]"
                >
                  <p className="mb-1 flex items-center gap-2 text-xs text-ink-soft">
                    <span className="text-accent">{it.authorName || "A member"}</span>
                    <span aria-hidden>·</span>
                    <span className="truncate">{it.seedTitle || "a seed"}</span>
                  </p>
                  <p className="text-sm leading-relaxed text-ink line-clamp-4">
                    {it.preview || "(no text)"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
