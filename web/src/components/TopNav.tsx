"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NavIcon } from "@/components/nav-items";
import { PlantButton } from "@/components/PlantButton";

// Desktop-only nav: the same five destinations as the mobile bottom bar, but as
// a compact labelled row in the top header — where desktop eyes and cursor
// already are. Hidden on phones (the bottom bar takes over there).
export function TopNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {NAV_ITEMS.map((t) => {
        if (t.key === "plant") return <PlantButton key="plant" variant="top" />;
        const on = isActive(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            title={t.label}
            className="relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition hover:bg-[rgba(76,175,80,0.1)]"
            style={{
              color: on ? "var(--accent)" : "var(--ink-mid)",
              background: on ? "rgba(76,175,80,0.16)" : undefined,
            }}
          >
            <span className="relative leading-none">
              <NavIcon name={t.key} size={18} />
              {t.badge && unread > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-bg">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
