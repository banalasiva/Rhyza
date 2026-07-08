"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A WhatsApp-style labelled bottom tab bar — the main way to get around. Words,
// not just icons, so it's obvious to everyone (including first-timers and older
// users). Fixed to the bottom where a thumb expects it.
const TABS = [
  { href: "/", label: "Home", icon: "🏡" },
  { href: "/explore", label: "Explore", icon: "🌍" },
  { href: "/search", label: "Search", icon: "🔍" },
  { href: "/notifications", label: "Alerts", icon: "🔔", badge: true },
  { href: "/roots", label: "You", icon: "🌳" },
];

export function BottomNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t backdrop-blur"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {TABS.map((t) => {
        const on = isActive(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 transition"
            style={{ color: on ? "var(--accent)" : "var(--ink-soft)" }}
          >
            <span className="relative text-[20px] leading-none">
              <span aria-hidden>{t.icon}</span>
              {t.badge && unread > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-bg">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            <span className="text-[11px] font-medium">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
