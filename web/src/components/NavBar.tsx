import Link from "next/link";
import { signOut } from "@/auth";

export function NavBar({ name }: { name: string }) {
  return (
    <header className="relative z-20 flex items-center justify-between px-5 py-3">
      <Link
        href="/"
        className="rounded-full border px-3 py-1.5 font-serif text-[15px] text-ink backdrop-blur"
        style={{ background: "rgba(7,13,7,0.82)" }}
      >
        🌱 Rhyza
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/notifications" className="text-sm text-ink-mid hover:text-ink">
          Notifications
        </Link>
        <span className="hidden text-sm text-ink-soft sm:inline">{name}</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
