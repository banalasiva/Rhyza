"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/nav-items";
import { PlantButton } from "@/components/PlantButton";

// A WhatsApp-style labelled bottom tab bar — the main way to get around on
// phones. Warm emoji glyphs with words under them, so it's obvious and friendly
// to everyone (including first-timers and older users). Fixed to the bottom
// where a thumb expects it. Hidden on desktop (md+), where the same
// destinations live in the top header as crisp line icons.
export function BottomNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex md:hidden"
      style={{
        // Opaque surface (not the translucent --surface) and NO backdrop blur:
        // a see-through bar let scrolling content smear a moving dark seam under
        // the top edge, which read as the whole bar sliding up and down. Solid =
        // rock steady.
        background: "var(--bg-surface)",
        // A soft elevation + faint hairline instead of a hard border line.
        boxShadow: "0 -0.5px 0 var(--border), 0 -6px 20px rgba(0,0,0,0.12)",
        paddingTop: "4px",
        // Sit a little higher, with a floor under the safe-area inset, so the
        // system nav (gesture bar or 3-button, OnePlus/Samsung/etc.) never
        // crowds the tabs.
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
      }}
    >
      {NAV_ITEMS.map((t) => {
        if (t.key === "plant") return <PlantButton key="plant" variant="bottom" />;
        const on = isActive(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 transition"
            style={{ color: on ? "var(--accent)" : "var(--ink-soft)" }}
          >
            {/* The active tab gets a glowing pill behind its icon, so it's always
                obvious which screen you're on. */}
            <span
              className="relative flex h-8 w-14 items-center justify-center rounded-full text-[20px] leading-none transition-all"
              style={
                on
                  ? { background: "rgba(76,175,80,0.18)", boxShadow: "0 0 10px rgba(76,175,80,0.25)" }
                  : undefined
              }
            >
              <span aria-hidden>{t.emoji}</span>
              {t.badge && unread > 0 && (
                <span className="absolute right-2 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-bg">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            <span className={`text-[11px] ${on ? "font-semibold" : "font-medium"}`}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
