import Link from "next/link";

// A friendly, self-dismissing "getting started" guide for the first run — the
// garden → seed → invite flow spelled out in plain words, so a first-timer
// always knows the one next thing to do. Disappears once all three are done.
export function GettingStarted({
  hasSeed,
  hasInvited,
  firstGardenId,
}: {
  hasSeed: boolean;
  hasInvited: boolean;
  firstGardenId?: string;
}) {
  if (hasSeed && hasInvited) return null; // fully set up — nothing to nudge

  const gardenHref = firstGardenId ? `/gardens/${firstGardenId}` : "#new-garden";
  const steps = [
    {
      done: true,
      n: 1,
      label: "Create your family space",
      sub: "A private place for your people — done!",
    },
    {
      done: hasSeed,
      n: 2,
      label: "Ask your first question",
      sub: "Plant a “seed” — anything your group wants to think through together.",
      href: `${gardenHref}#plant-seed`,
      cta: "Ask a question",
    },
    {
      done: hasInvited,
      n: 3,
      label: "Invite your people",
      sub: "Bring your family or friends in so they can weigh in.",
      href: `${gardenHref}#invite`,
      cta: "Invite people",
    },
  ];

  return (
    <div className="card mb-6 p-5">
      <p className="eyebrow mb-1">✨ Getting started</p>
      <p className="mb-4 text-xs text-ink-soft">Two quick steps and your space comes alive.</p>
      <ul className="space-y-4">
        {steps.map((s) => (
          <li key={s.n} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={
                s.done
                  ? { background: "var(--accent)", color: "var(--bg)" }
                  : { border: "1px solid var(--border)", color: "var(--ink-soft)" }
              }
            >
              {s.done ? "✓" : s.n}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${s.done ? "text-ink-soft line-through" : "text-ink"}`}>{s.label}</p>
              {!s.done && <p className="mt-0.5 text-xs text-ink-mid">{s.sub}</p>}
              {!s.done && s.href && (
                <Link href={s.href} className="btn-primary mt-2 inline-flex text-xs">
                  {s.cta}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
