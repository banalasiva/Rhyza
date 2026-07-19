import Link from "next/link";
import Image from "next/image";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { NavSidebar } from "@/components/NavSidebar";
import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FeedbackButton } from "@/components/FeedbackButton";
import { HelpButton } from "@/components/HelpButton";
import { NamePrompt } from "@/components/NamePrompt";
import { displayName } from "@/lib/display-name";

export async function NavBar({ name }: { name?: string }) {
  const session = await auth();
  const userId = session?.user?.id;
  const [unread, me] = userId
    ? await Promise.all([
        db.notification.count({ where: { recipientId: userId, readAt: null } }),
        db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
      ])
    : [0, null];
  // First sign-in (esp. via email magic-link): no display name yet → greet once
  // and ask what to call them, pre-filled with a guess from their email.
  const needsName = !!me && !me.name?.trim();

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
          <HelpButton />
          <ThemeToggle />
        </div>
      </header>
      <BottomNav unread={unread} />
      {needsName && <NamePrompt suggested={displayName({ name: me?.name, email: me?.email })} />}
    </>
  );
}
