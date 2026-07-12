import Link from "next/link";
import { suggestedConnections } from "@/lib/services/members";
import { Avatar } from "@/components/Avatar";
import { ConnectButton } from "@/components/ConnectButton";

// "People you may know" — a fast-connect strip for onboarding. The moment
// someone joins (usually via an invite to a seed), the people they're already
// alongside show up here so they can send connects in one tap — and once
// connected, add each other straight into seeds. Renders nothing when there's
// no one to suggest, so it quietly disappears as your circle fills in.
export async function PeopleToConnect({ userId }: { userId: string }) {
  const people = await suggestedConnections(userId).catch(() => []);
  if (people.length === 0) return null;

  return (
    <section className="mb-5 rounded-2xl border border-[rgba(76,175,80,0.22)] bg-[rgba(76,175,80,0.05)] p-4">
      <p className="eyebrow mb-0.5">🤝 People you may know</p>
      <p className="mb-3 text-xs text-ink-soft">
        Connect, and you can add each other straight into seeds.
      </p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {people.map((p) => (
          <div
            key={p.id}
            className="flex w-32 shrink-0 flex-col items-center rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(7,13,7,0.35)] p-3 text-center"
          >
            <Link href={`/u/${p.id}`} aria-label={`View ${p.name}`}>
              <Avatar name={p.name} image={p.image} size={44} />
            </Link>
            <Link href={`/u/${p.id}`} className="mt-1.5 w-full truncate text-xs text-ink hover:text-accent">
              {p.name}
            </Link>
            <div className="mt-2">
              <ConnectButton userId={p.id} initialStatus={p.status} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
