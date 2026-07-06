import Link from "next/link";
import Image from "next/image";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { NavSidebar } from "@/components/NavSidebar";
import { BottomNav } from "@/components/BottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";

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
        {/* Light/dark toggle — now that the top bar is uncluttered, it lives
            here where it's easy to find. */}
        <ThemeToggle />
      </header>
      <BottomNav unread={unread} />
    </>
  );
}
