import Link from "next/link";
import Image from "next/image";
import { HelpButton } from "@/components/HelpButton";
import { ThemeToggle } from "@/components/ThemeToggle";

// Header for the signed-out / guest experience — logo (back to the public
// square), the how-it-works help, the light/dark toggle, and Sign in. So a guest
// browsing gets the real ThinkThru feel, not a stripped page.
export function GuestTopBar({ next = "/look" }: { next?: string }) {
  const login = `/login?next=${encodeURIComponent(next)}`;
  return (
    <header className="relative z-20 flex items-center justify-between px-5 py-3">
      <Link href="/look" className="flex items-center gap-2" title="Browse public seeds">
        <Image src="/emblem.png" alt="" width={26} height={26} className="rounded-lg" />
        <span className="serif-lg">ThinkThru</span>
      </Link>
      <div className="flex items-center gap-2">
        <HelpButton />
        <ThemeToggle />
        <Link href={login} className="btn-primary text-sm">
          Sign in
        </Link>
      </div>
    </header>
  );
}
