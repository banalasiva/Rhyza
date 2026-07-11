import Link from "next/link";
import Image from "next/image";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { NavSidebar } from "@/components/NavSidebar";
import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FeedbackButton } from "@/components/FeedbackButton";

export async function NavBar({ name }: { name?: string }) {
  const session = await auth();
  const userId = session?.user?.id;
  const unread = userId
    ? await db.notification.count({ where: { recipientId: userId, readAt: null } })
    : 0;

  return (
    <>
      <header className="relative z-20 flex items-center justify-between px-5 py-3">
        {/* Logo + side-panel toggle. Sign out lives inside the panel. The main
            destinations now live in the labelled bottom bar below. */}
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
            style={{ background: "var(--surface)" }}
          >
            <Image src="/emblem.png" alt="" width={22} height={22} className="h-[22px] w-[22px]" />
            ThinkThru
          </Link>
        </div>
        {/* Desktop main nav — the five destinations as a labelled row. On phones
            this is hidden and the fixed bottom bar takes over. */}
        <TopNav unread={unread} />
        {/* About + light/dark toggle — matching circular controls, top-right. */}
        <div className="flex items-center gap-2">
          <FeedbackButton />
          <Link
            href="/about"
            aria-label="About ThinkThru"
            title="About ThinkThru"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(76,175,80,0.25)] font-serif text-base text-ink-soft transition hover:border-[rgba(76,175,80,0.5)] hover:text-ink"
          >
            ?
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <BottomNav unread={unread} />
    </>
  );
}
