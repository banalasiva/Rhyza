import Link from "next/link";
import type { YourTurnItem } from "@/lib/services/yourturn";

// "It's your turn" — the strongest reason to come back: things waiting on YOU.
// Shown at the very top of Home so it's the first thing an returning person sees.
export function YourTurn({ items }: { items: YourTurnItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mb-5 rounded-2xl border border-[rgba(255,179,0,0.35)] bg-[rgba(255,179,0,0.06)] p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <span aria-hidden>✋</span> It&apos;s your turn
      </p>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.seedId}>
            <Link
              href={`/seeds/${it.seedId}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(255,179,0,0.2)] bg-[var(--surface)] p-3 transition hover:border-[rgba(255,179,0,0.5)]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">{it.title}</span>
                <span className="block text-xs text-ink-soft">
                  {it.reason === "ask" ? "🌱 " : it.reason === "weigh-in" ? "⚖️ " : "💬 "}
                  {it.detail}
                </span>
              </span>
              <span className="shrink-0 text-xs font-medium text-bloom">
                {it.reason === "ask" ? "Answer →" : it.reason === "weigh-in" ? "Weigh in →" : "Reply →"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
