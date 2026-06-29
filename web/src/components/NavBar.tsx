import Link from "next/link";
import Image from "next/image";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { NavSidebar } from "@/components/NavSidebar";

export async function NavBar({ name }: { name?: string }) {
  const session = await auth();
  const userId = session?.user?.id;
  const unread = userId
    ? await db.notification.count({ where: { recipientId: userId, readAt: null } })
    : 0;

  return (
    <header className="relative z-20 flex items-center justify-between px-5 py-3">
      {/* Logo + side-panel toggle. Sign out lives inside the panel. */}
      <div className="flex items-center gap-2">
        <NavSidebar
          signOut={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        />
        <Link
          href="/"
          title="Back to your gardens"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-serif text-[15px] text-ink backdrop-blur transition hover:border-accent"
          style={{ background: "rgba(7,13,7,0.82)" }}
        >
          <Image src="/emblem.png" alt="" width={22} height={22} className="h-[22px] w-[22px]" />
          ThinkThru
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {/* Public square */}
        <Link
          href="/explore"
          title="Explore public seeds"
          className="rounded-full border border-[rgba(76,175,80,0.2)] bg-[rgba(7,13,7,0.6)] px-2.5 py-1.5 text-sm text-ink-mid transition hover:text-ink"
        >
          <span aria-hidden>🌍</span> <span className="hidden sm:inline">Explore</span>
        </Link>
        {/* Notifications bell with unread badge */}
        <Link
          href="/notifications"
          title="Notifications"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative rounded-full border border-[rgba(76,175,80,0.2)] bg-[rgba(7,13,7,0.6)] px-2.5 py-1.5 text-sm text-ink-mid transition hover:text-ink"
        >
          <span aria-hidden>🔔</span>
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-bg">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <Link
          href="/roots"
          title="What you've grown"
          className="flex items-center gap-1 text-sm text-ink-soft transition hover:text-ink"
        >
          🌳 <span className="hidden sm:inline">{name ?? session?.user?.name}</span>
        </Link>
      </div>
    </header>
  );
}
