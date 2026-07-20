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
import { cookies } from "next/headers";
import { isGuestEmail } from "@/lib/guest";
import { GuestMergeWatcher } from "@/components/GuestMergeWatcher";

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

  // A guest→account merge is pending iff a "tt-was-guest" marker exists, we're
  // now signed in as a REAL account, and the marker names a different (guest)
  // user. Only then do we mount the watcher — so the merge fires after ANY
  // sign-in path (Save-your-account OR a plain login), and no request is made
  // for ordinary users who were never guests.
  const wasGuest = cookies().get("tt-was-guest")?.value;
  const mergePending =
    !!wasGuest && !!userId && wasGuest !== userId && !!me && !isGuestEmail(me.email);

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
      {mergePending && <GuestMergeWatcher />}
      {/* Guests: a quiet, ever-present nudge to save their account — nothing is
          lost, and it unlocks AI + starting their own seeds. */}
      {isGuestEmail(me?.email) && (
        <Link
          href="/account"
          className="relative z-10 mx-4 mb-2 flex items-center justify-between gap-2 rounded-xl border border-[rgba(76,175,80,0.35)] bg-[rgba(76,175,80,0.08)] px-3 py-2 text-xs transition hover:bg-[rgba(76,175,80,0.14)]"
        >
          <span className="text-ink">
            🌱 You&apos;re a guest — <span className="text-ink-soft">save your account to keep it &amp; ask AI</span>
          </span>
          <span className="shrink-0 font-medium text-accent">Save →</span>
        </Link>
      )}
      {needsName && <NamePrompt suggested={displayName({ name: me?.name, email: me?.email })} />}
    </>
  );
}
